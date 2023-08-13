const app = require('express')();
const express = require('express')
app.use(express.static('public'));
const server = require('http').createServer(app)
const io = require('socket.io')(server);
const sqlite3 = require('sqlite3').verbose();
const PORT = process.env.PORT || 3000

const db = new sqlite3.Database('./chat_logs.db', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('[Database] Connected to the chat_logs database.');
    db.run('CREATE TABLE IF NOT EXISTS messages (message TEXT, user TEXT, date TEXT)', (err) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log('[Database] Table created successfully');
      }
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
//Send chat.html for user on website to view
server.listen(PORT, () => {
  console.log('[Server] started on port: ' + PORT);
});

const MAX_MESSAGES = 5;
const messages = [];

io.on('connection', (socket) => {
  // On connect,...
  socket.on('disconnect', () => {
    io.emit('send message', {
      message: `${socket.username} has left the server.`,
      user: "[Server]"
    })
  });

  // Handles Messages
  socket.on('new message', (msg) => {
    console.log("[" + socket.username + "]" + " " + msg);

    messages.push({message: msg, user: socket.username});
    if (messages.length > MAX_MESSAGES) {
      messages.shift();
    }

    io.emit('send message', {
      message: msg,
      user: socket.username
    });

    // Save message to sqlite database
    db.run(`INSERT INTO messages(message, user) VALUES (?, ?)`, [msg, socket.username], function(err) {
      if (err) {
        console.error(err.message);
      }
    });
  });

  // On user join
  socket.on('new user', (usr) => {
    socket.username = usr;
    io.emit('send message', {
      message: `${socket.username} has joined the server`,
      user: "[Server]"
    })

    // Select all messages from database and emit them to the client
    db.all(`SELECT * FROM messages`, (err, rows) => {
      if (err) {
        console.error(err.message);
        return;
      }

      messages.splice(0, messages.length, ...rows.slice(-MAX_MESSAGES).map(row => ({
        message: row.message,
        user: row.user,
      })));

      messages.forEach(msg => {
        io.emit('send message', msg);
      });
    });
  });
});