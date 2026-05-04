const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure products.json exists
if (!fs.existsSync(PRODUCTS_FILE)) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([], null, 2));
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Load products
function loadProducts() {
  try {
    const data = fs.readFileSync(PRODUCTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// Save products
function saveProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

// REST API endpoints
app.get('/api/products', (req, res) => {
  const products = loadProducts();
  res.json(products);
});

app.post('/api/products', upload.single('image'), (req, res) => {
  const { name, price, category, description } = req.body;
  
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const products = loadProducts();
  const newProduct = {
    id: Date.now(),
    name,
    price: parseFloat(price),
    category,
    description: description || '',
    image: req.file ? req.file.buffer.toString('base64') : null,
    createdAt: new Date().toISOString()
  };

  products.push(newProduct);
  saveProducts(products);

  // Broadcast to all connected clients
  io.emit('productAdded', newProduct);

  res.status(201).json(newProduct);
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Send current products to new user
  const products = loadProducts();
  socket.emit('loadProducts', products);

  // Simulate upload progress
  socket.on('startUpload', (data) => {
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        socket.emit('uploadProgress', { progress });
        clearInterval(progressInterval);
      } else {
        socket.emit('uploadProgress', { progress: Math.min(progress, 99) });
      }
    }, 200);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Fallback - serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║    🚀 Shape Portal Running             ║
║    Port: ${PORT}                            ║
║    Admin: http://localhost:${PORT}?role=admin   ║
║    Buyer: http://localhost:${PORT}?role=buyer   ║
╚════════════════════════════════════════╝
  `);
});
