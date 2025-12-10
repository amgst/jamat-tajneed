
const http = require('http');

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function test() {
    try {
        // 1. Get a member to link to
        console.log('Fetching members...');
        const membersRes = await request({
            hostname: 'localhost',
            port: 3001,
            path: '/api/members',
            method: 'GET'
        });

        if (membersRes.body.length === 0) {
            console.log('No members found to test with.');
            return;
        }

        const memberId = membersRes.body[0].id;
        console.log(`Using Member ID: ${memberId}`);

        // 2. Create Waqf Record
        console.log('Creating Waqf Record...');
        const postRes = await request({
            hostname: 'localhost',
            port: 3001,
            path: '/api/waqf-jadeed',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            memberId: memberId,
            year: 2025,
            promiseAmount: 5000,
            paidAmount: 1000,
            notes: 'Test Note'
        });

        console.log('Create Response:', postRes.body);

        // 3. Fetch Records
        console.log('Fetching Waqf Records...');
        const getRes = await request({
            hostname: 'localhost',
            port: 3001,
            path: `/api/waqf-jadeed?year=2025&memberId=${memberId}`,
            method: 'GET'
        });

        console.log('Fetch Response:', getRes.body);

        if (getRes.body.length > 0 && getRes.body[0].promiseAmount === 5000) {
            console.log('SUCCESS: API verification passed.');
        } else {
            console.log('FAILURE: API verification failed.');
        }

    } catch (err) {
        console.error('Test failed:', err);
    }
}

test();
