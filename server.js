const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// CRITICAL: maxHttpBufferSize must be large for image uploads
const io = socketIo(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e8,  // 100 MB - for product images
  pingTimeout: 60000
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'products.json');

// Load products from disk on startup
let products = [];
try {
  if (fs.existsSync(DATA_FILE)) {
    products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log('✅ Loaded ' + products.length + ' products from disk');
  } else {
    console.log('📁 No products file - starting fresh');
  }
} catch (e) {
  console.log('⚠️ Could not load products: ' + e.message);
  products = [];
}

// Save products to disk
function saveProducts() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
    console.log('💾 Saved ' + products.length + ' products to disk');
  } catch (e) {
    console.log('⚠️ Save failed: ' + e.message);
  }
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io
io.on('connection', (socket) => {
  console.log('🔌 Client connected: ' + socket.id + ' (total: ' + io.engine.clientsCount + ')');
  
  // Send all products immediately to new client
  socket.emit('products-list', products);
  
  // Admin requests products
  socket.on('get-products', () => {
    console.log('📤 Sending products to ' + socket.id);
    socket.emit('products-list', products);
  });
  
  // Admin adds a product
  socket.on('add-product', (product, callback) => {
    console.log('➕ New product: ' + product.name + ' (code: ' + product.code + ')');
    
    // Check for duplicate
    if (products.find(p => p.code === product.code)) {
      console.log('   ❌ Duplicate code');
      if (typeof callback === 'function') callback({ success: false, error: 'Code already exists' });
      return;
    }
    
    products.unshift(product);
    saveProducts();
    
    // Broadcast to ALL clients (including sender)
    io.emit('products-list', products);
    console.log('   📡 Broadcasted to ' + io.engine.clientsCount + ' clients');
    
    if (typeof callback === 'function') callback({ success: true });
  });
  
  // Admin deletes a product
  socket.on('delete-product', (productId) => {
    products = products.filter(p => p.id !== productId);
    saveProducts();
    io.emit('products-list', products);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Disconnected: ' + socket.id);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🚀 Shape Portal LIVE on port ' + PORT + '       ║');
  console.log('║  📦 Products in store: ' + products.length + '              ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
});
