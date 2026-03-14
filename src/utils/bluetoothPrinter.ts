const DEFAULT_CHUNK_SIZE = 20;
const LINE_WIDTH = 32;

type PrintableLine = string;

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
    lines.push(pair('Family', data.familyName));
    lines.push(pair('Family No', familyNo));
    if (data.headName) lines.push(pair('Head', data.headName));
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
    const lines = buildFamilyReceiptLines(data);
    const payload = encodeEscPos(lines);
    const { characteristic } = await getConnection();
    await writeInChunks(characteristic, payload);
}
