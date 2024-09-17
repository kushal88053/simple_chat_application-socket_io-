const express = require('express');
const { createServer } = require('node:http');
const path = require('path'); 
const { Server } = require('socket.io');
const connect = require('./connect');
const { availableParallelism } = require('node:os');
const cluster = require('node:cluster');
const { createAdapter, setupPrimary } = require('@socket.io/cluster-adapter');

if (cluster.isPrimary) {
    const numCPUs = availableParallelism();
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork({
            PORT: 3000 + i
        });
    }

    return setupPrimary();
}

async function main() {
    const app = express();
    const server = createServer(app);
    const io = new Server(server, {
        connectionStateRecovery: {},
        adapter: createAdapter()
    });
    db = await connect();
    // Serving static files
    app.use(express.static(path.resolve(__dirname, 'public')));

    // Sending the main HTML file
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    io.on('connection', async (socket) => {
        console.log('A user connected');

        // Handling incoming chat messages
        socket.on('chat message', async (msg, clientOffset, callback) => {
            let result;
            console.log('Received message: ', msg);

            try {
                // Inserting message into the database
                result =  await db.run('INSERT INTO messages (content, client_offset) VALUES (?, ?)', msg, clientOffset);
            } catch (e) {
                if (e.errno === 19 /* SQLITE_CONSTRAINT */) {
                    callback();  // If the message is a duplicate, just acknowledge
                    return;
                } else {
                    console.error('Database error:', e);
                    return;
                }
            }

            // Broadcasting the message to all connected clients
            console.log('Broadcasting message to all clients:', msg, result.lastID);
            io.emit('chat message', msg, result.lastID);

            // Acknowledging the sender
            callback();
        });

        // Sending old messages if the client is not recovered
        if (!socket.recovered) {
            try {
                const rows = await db.all('SELECT id, content FROM messages WHERE id > ?', [socket.handshake.auth.serverOffset || 0]);
                rows.forEach(row => {
                    socket.emit('chat message', row.content, row.id);  // Sending old messages to the client
                });
            } catch (e) {
                console.error('Error fetching old messages:', e);
            }
        }
    });

    const port = process.env.PORT || 3000;

    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

main();
