const DEFAULT_CHUNK_SIZE = 20;
const LINE_WIDTH = 32;
const PRINTER_DOTS = 384;

type PrintableLine = string;
const FAMILY_IMAGE_MARKER = '__FAMILY_IMAGE__';

export interface FamilyReceiptData {
    familyName: string;
    familyNumber?: number;
    headName?: string;
    headPhone?: string;
    totalPromise: number;
    totalPaid: number;
    totalBalance: number;
}

type PrinterConnection = {
    device: BluetoothDevice;
    characteristic: BluetoothRemoteGATTCharacteristic;
};

let cachedConnection: PrinterConnection | null = null;

const OPTIONAL_SERVICE_UUIDS: BluetoothServiceUUID[] = [
    0xFFE0,
    0xFF00,
    0x18F0,
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '000018f0-0000-1000-8000-00805f9b34fb'
];

function sanitizeText(input: string): string {
    return input.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

function formatAmount(value: number): string {
    return Math.round(value).toString();
}

function buildFamilyReceiptLines(data: FamilyReceiptData): PrintableLine[] {
    const lines: PrintableLine[] = [];
    const familyNo = data.familyNumber ? `#${data.familyNumber}` : 'N/A';

    lines.push(center('Jamat Tajneed'));
    lines.push(center('Waqf-e-Jadeed Family'));
    lines.push(line());
    lines.push(pair('Family No', familyNo));
    lines.push(FAMILY_IMAGE_MARKER);
    if (data.headPhone) lines.push(pair('Phone', data.headPhone));
    lines.push(line());
    lines.push(pair('Total Promise', `Rs ${formatAmount(data.totalPromise)}`));
    lines.push(pair('Total Paid', `Rs ${formatAmount(data.totalPaid)}`));
    lines.push(pair('Balance', `Rs ${formatAmount(data.totalBalance)}`));
    lines.push(line());
    lines.push(center(`Generated ${new Date().toLocaleDateString()}`));
    return lines;
}

function center(text: string): string {
    const safe = sanitizeText(text);
    if (safe.length >= LINE_WIDTH) return safe.slice(0, LINE_WIDTH);
    const pad = Math.floor((LINE_WIDTH - safe.length) / 2);
    return ' '.repeat(pad) + safe;
}

function line(): string {
    return '-'.repeat(LINE_WIDTH);
}

function pair(label: string, value: string): string {
    const safeLabel = sanitizeText(label);
    const safeValue = sanitizeText(value) || 'Unknown';
    const combined = `${safeLabel}: ${safeValue}`;
    if (combined.length <= LINE_WIDTH) return combined;
    return combined.slice(0, LINE_WIDTH);
}

function encodeEscPos(lines: PrintableLine[]): Uint8Array {
    const encoder = new TextEncoder();
    const init = new Uint8Array([0x1b, 0x40]);
    const alignLeft = new Uint8Array([0x1b, 0x61, 0x00]);
    const boldOn = new Uint8Array([0x1b, 0x45, 0x01]);
    const boldOff = new Uint8Array([0x1b, 0x45, 0x00]);
    const feed = new Uint8Array([0x0a]);
    const cut = new Uint8Array([0x1d, 0x56, 0x01]);

    const chunks: Uint8Array[] = [];
    chunks.push(init);
    chunks.push(alignLeft);
    chunks.push(boldOn);
    chunks.push(encoder.encode(`${lines[0] || ''}\n`));
    chunks.push(boldOff);

    for (let i = 1; i < lines.length; i += 1) {
        chunks.push(encoder.encode(`${lines[i]}\n`));
    }

    chunks.push(feed);
    chunks.push(feed);
    chunks.push(cut);

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Uint8Array(totalLength);
    let offset = 0;
    chunks.forEach(chunk => {
        output.set(chunk, offset);
        offset += chunk.length;
    });
    return output;
}

function renderUrduToCanvas(text: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        canvas.width = PRINTER_DOTS;
        canvas.height = 48;
        return canvas;
    }

    let fontSize = 28;
    const fontFamily = '"Noto Nastaliq Urdu", "Noto Sans Arabic", serif';
    ctx.font = `${fontSize}px ${fontFamily}`;
    const padding = 8;
    let measured = ctx.measureText(text);
    if (measured.width > PRINTER_DOTS - padding * 2) {
        const scale = (PRINTER_DOTS - padding * 2) / measured.width;
        fontSize = Math.max(14, Math.floor(fontSize * scale));
        ctx.font = `${fontSize}px ${fontFamily}`;
        measured = ctx.measureText(text);
    }

    const height = Math.max(36, Math.ceil(fontSize * 1.6));
    canvas.width = PRINTER_DOTS;
    canvas.height = height;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    return canvas;
}

function encodeRasterImage(canvas: HTMLCanvasElement): Uint8Array {
    const ctx = canvas.getContext('2d');
    if (!ctx) return new Uint8Array();

    const width = canvas.width;
    const height = canvas.height;
    const widthBytes = Math.ceil(width / 8);
    const imageData = ctx.getImageData(0, 0, width, height).data;
    const bytes = new Uint8Array(widthBytes * height);

    for (let y = 0; y < height; y += 1) {
        for (let xByte = 0; xByte < widthBytes; xByte += 1) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit += 1) {
                const x = xByte * 8 + bit;
                if (x >= width) continue;
                const idx = (y * width + x) * 4;
                const r = imageData[idx];
                const g = imageData[idx + 1];
                const b = imageData[idx + 2];
                const a = imageData[idx + 3];
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
                const isBlack = a > 0 && luminance < 160;
                if (isBlack) {
                    byte |= 0x80 >> bit;
                }
            }
            bytes[y * widthBytes + xByte] = byte;
        }
    }

    const header = new Uint8Array([
        0x1d, 0x76, 0x30, 0x00,
        widthBytes & 0xff,
        (widthBytes >> 8) & 0xff,
        height & 0xff,
        (height >> 8) & 0xff
    ]);

    const output = new Uint8Array(header.length + bytes.length);
    output.set(header, 0);
    output.set(bytes, header.length);
    return output;
}

async function buildFamilyReceiptPayload(data: FamilyReceiptData): Promise<Uint8Array[]> {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const lines = buildFamilyReceiptLines(data);

    chunks.push(new Uint8Array([0x1b, 0x40])); // init
    chunks.push(new Uint8Array([0x1b, 0x61, 0x00])); // align left
    chunks.push(new Uint8Array([0x1b, 0x45, 0x01])); // bold on
    chunks.push(encoder.encode(`${lines[0] || ''}\n`));
    chunks.push(new Uint8Array([0x1b, 0x45, 0x00])); // bold off

    for (let i = 1; i < lines.length; i += 1) {
        if (lines[i] === FAMILY_IMAGE_MARKER) {
            if (data.familyName) {
                chunks.push(encoder.encode('Family:\n'));
                const familyCanvas = renderUrduToCanvas(data.familyName);
                chunks.push(encodeRasterImage(familyCanvas));
                chunks.push(encoder.encode('\n'));
            }
            continue;
        }
        chunks.push(encoder.encode(`${lines[i]}\n`));
    }

    chunks.push(new Uint8Array([0x0a, 0x0a]));
    chunks.push(new Uint8Array([0x1d, 0x56, 0x01]));
    return chunks;
}

async function pickWritableCharacteristic(device: BluetoothDevice): Promise<BluetoothRemoteGATTCharacteristic> {
    const server = await device.gatt?.connect();
    if (!server) {
        throw new Error('Bluetooth connection failed');
    }
    const services = await server.getPrimaryServices();
    for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const characteristic of characteristics) {
            if (characteristic.properties.write || characteristic.properties.writeWithoutResponse) {
                return characteristic;
            }
        }
    }
    throw new Error('No writable characteristic found');
}

async function getConnection(): Promise<PrinterConnection> {
    if (cachedConnection?.device?.gatt?.connected) return cachedConnection;

    if (navigator.bluetooth.getDevices) {
        const devices = await navigator.bluetooth.getDevices();
        if (devices.length > 0) {
            const preferred = devices.find(device => (device.name || '').toLowerCase().includes('speedx'));
            const device = preferred || devices[0];
            const characteristic = await pickWritableCharacteristic(device);
            cachedConnection = { device, characteristic };
            return cachedConnection;
        }
    }

    const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: OPTIONAL_SERVICE_UUIDS
    });

    const characteristic = await pickWritableCharacteristic(device);
    cachedConnection = { device, characteristic };
    return cachedConnection;
}

async function writeInChunks(characteristic: BluetoothRemoteGATTCharacteristic, data: Uint8Array): Promise<void> {
    let offset = 0;
    while (offset < data.length) {
        const chunk = data.slice(offset, offset + DEFAULT_CHUNK_SIZE);
        if (characteristic.properties.writeWithoutResponse) {
            await characteristic.writeValueWithoutResponse(chunk);
        } else {
            await characteristic.writeValue(chunk);
        }
        offset += DEFAULT_CHUNK_SIZE;
    }
}

export async function printFamilyReceiptBluetooth(data: FamilyReceiptData): Promise<void> {
    const { characteristic } = await getConnection();
    const chunks = await buildFamilyReceiptPayload(data);
    for (const chunk of chunks) {
        if (chunk.length === 0) continue;
        await writeInChunks(characteristic, chunk);
    }
}
