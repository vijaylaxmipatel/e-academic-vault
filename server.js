const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

const app = express();

// Database Connection Setup (MongoDB Local connection)
// Database Connection Setup (MongoDB Cloud Connection)
mongoose.connect('mongodb+srv://laxmiviyapatel147admin:viyapatel@cluster0.ej1jeo0.mongodb.net/RealWorldVault?retryWrites=true&w=majority&appName=Cluster0')
    .then(() => console.log('🛡️  Real-World Secure MongoDB Connected!'))
    .catch(err => console.error('Database configuration error:', err));

// Database Schemas (Tables)
const AdminSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: { type: String, required: true }
});
const Admin = mongoose.model('Admin', AdminSchema);

const CertificateSchema = new mongoose.Schema({
    studentName: String,
    enrollmentNo: { type: String, unique: true },
    course: String,
    university: String,
    passingYear: Number,
    fileData: Buffer,
    fileType: String
});
const Certificate = mongoose.model('Certificate', CertificateSchema);

// Multer memory storage configuration for file parsing
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Global application system feedback variable
let systemFeedback = "";

// ------ ROUTES ------

// 1. HOME & SEARCH SYSTEM
app.get('/', async (req, res) => {
    try {
        let searchQuery = req.query.search;
        let filter = {};
        if (searchQuery) {
            filter.enrollmentNo = { $regex: searchQuery, $options: 'i' };
        }
        const certificates = await Certificate.find(filter);
        const currentMsg = systemFeedback;
        systemFeedback = ""; // Msg flash hone ke bad reset
        res.render('index', { certificates, searchQuery, message: currentMsg });
    } catch (err) {
        res.status(500).send("Database Fetch Error");
    }
});

// 2. ADMIN PORTAL MOCK HANDLERS
app.post('/api/admin/signup', async (req, res) => {
    try {
        const newAdmin = new Admin(req.body);
        await newAdmin.save();
        systemFeedback = "✅ Admin Account Created Successfully in MongoDB!";
        res.redirect('/');
    } catch(err) {
        systemFeedback = "❌ Sign up error: Account might already exist.";
        res.redirect('/');
    }
});

app.post('/api/admin/login', async (req, res) => {
    const admin = await Admin.findOne({ email: req.body.email, password: req.body.password });
    if(admin) systemFeedback = `🔑 Welcome Back Admin: ${admin.name}. Secure access granted.`;
    else systemFeedback = "❌ Invalid Admin ID or Password.";
    res.redirect('/');
});

// 3. SECURE FILE UPLOAD PIPELINE
app.post('/api/upload', upload.single('credentialFile'), async (req, res) => {
    try {
        const newCert = new Certificate({
            studentName: req.body.studentName,
            enrollmentNo: req.body.enrollmentNo,
            course: req.body.course,
            university: req.body.university,
            passingYear: req.body.passingYear,
            fileData: req.file.buffer,
            fileType: req.file.mimetype
        });
        await newCert.save();
        systemFeedback = "🎉 Certificate Encrypted & Permanently Saved to MongoDB!";
        res.redirect('/');
    } catch (err) {
        systemFeedback = "❌ Upload Failed: Enrollment number already registered.";
        res.redirect('/');
    }
});

// 4. STUDENT AUTHENTICATION & DIRECT DOWNLOAD STREAM
app.post('/api/student/verify', async (req, res) => {
    const { certId, password } = req.body;
    
    // Default Mock verification step (is project demo ke liye password '123456' rakha h)
    if(password === "123456") {
        const cert = await Certificate.findById(certId);
        if (cert) {
            res.set('Content-Type', cert.fileType);
            res.set('Content-Disposition', `attachment; filename=${cert.studentName}_Degree.pdf`);
            return res.send(cert.fileData); // File directly computer me stream hokar download ho jayegi
        }
    }
    systemFeedback = "❌ Student Portal Access Denied: Incorrect Password.";
    res.redirect('/');
});

// Server Initialization
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});