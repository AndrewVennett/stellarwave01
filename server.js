require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

const selectItems = [
  { articleId: '1ght', name: 'Text', price: 1.99, boxCheck: false, fileSize: 0.5 },
  { articleId: '2ght', name: 'Picture', price: 4.99, boxCheck: false, fileSize: 3 },
  { articleId: '3ght', name: 'Audio', price: 59.99, boxCheck: false, fileSize: 7 },
  { articleId: '4ght', name: 'Video', price: 999.99, boxCheck: false, fileSize: 14 }
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const userInfo = JSON.parse(req.body.userInfo || '{}');
    const firstName = userInfo.firstName || 'Unknown';
    const lastName = userInfo.lastName || 'Unknown';
    const timestamp = new Date().toUTCString().replace(/[: ]/g, '_');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${firstName}_${lastName}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // Max 15MB for all files
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.png', '.wav', '.mp3', '.mp4', '.txt'];
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File must be ${allowedExts.join(' or ')}`));
    }
  }
});

app.get('/api/items', (req, res) => {
  res.json(selectItems);
});

app.post('/api/total', (req, res) => {
  const selectedArticleIds = JSON.parse(req.body.articleIds);
  let totalPrice = 0;

  selectedArticleIds.forEach(id => {
    const item = selectItems.find(item => item.articleId === id);
    if (item) {
      totalPrice += item.price;
    }
  });

  res.status(200).json({ totalAmount: totalPrice * 100 });
});

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { firstName, lastName, paymentMethodId, totalAmount } = req.body;
    if (!totalAmount) {
      return res.status(400).send({ error: "Invalid total amount" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: `${req.protocol}://${req.get('host')}/success.html`
    });

    res.json({ clientSecret: paymentIntent.client_secret, redirectUrl: '/success.html' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: err.message });
  }
});

app.post('/upload', upload.single('file'), (req, res) => {
  try {
    const fileSize = req.file.size;
    const articleId = req.body.articleId;
    const item = selectItems.find(item => item.articleId === articleId);
    let maxSize;

    if (item.name === 'Picture') {
      maxSize = 5 * 1024 * 1024;
    } else if (item.name === 'Audio') {
      maxSize = 10 * 1024 * 1024;
    } else if (item.name === 'Video') {
      maxSize = 15 * 1024 * 1024;
    }

    if (fileSize > maxSize) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `File exceeds ${(maxSize / (1024 * 1024)).toFixed(2)}MB limit` });
    }

    res.json({ message: `File ${req.file.originalname} uploaded successfully! Size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB`, filename: req.file.filename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/upload-user-info', upload.single('userInfo'), (req, res) => {
  try {
    const userInfo = req.body.userInfo;
    const filename = req.body.filename;
    fs.writeFileSync(path.join(__dirname, 'Uploads', filename), userInfo);
    res.json({ message: 'User info saved successfully', filename: filename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/upload-files', upload.array('files'), (req, res) => {
  try {
    res.json({ message: 'Files uploaded successfully', filenames: req.files.map(file => file.filename) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/payment.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});

app.get('/update.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'update.html'));
});

app.get('/success.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});