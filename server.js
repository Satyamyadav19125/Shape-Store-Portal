const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
let products = [];

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Send current products
  socket.emit('update-products', products);
  
  // When admin adds product
  socket.on('admin-add-product', (product) => {
    products.unshift(product);
    console.log('Added:', product.name);
    io.emit('update-products', products);
  });
  
  // When someone requests products
  socket.on('get-products', () => {
    socket.emit('update-products', products);
  });
});

// Start server
server.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
