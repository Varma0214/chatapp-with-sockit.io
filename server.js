const express = require("express");
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors());

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};
connectDB();
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
});

const User = mongoose.model('User', UserSchema);

app.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });

    await newUser.save();
    res.json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});


app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login successful', token });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

const http = require("http");
const socketIo = require("socket.io");
const server = http.createServer(app);

const io = socketIo(server);

app.use(express.static("public"));


const users = new Set();

io.on("connection", (socket) => {
  console.log("A user is now connected");

  //handle users when they will join the chat
  socket.on("join", (userName) => {
    users.add(userName);
    socket.userName = userName;

    //displaying to all clients/users that a new user has joined
    io.emit("userJoined", userName);

    //Send the updated user list to all clients
    io.emit("userList", Array.from(users));
  });

  //handle incoming chat message
  socket.on("chatMessage", (message) => {
    //broadcast the received message to all connected clients
    io.emit("chatMessage", message);
  });

  //handle user disconnection
  socket.on("disconnect", () => {
    console.log("An User is disconnected", socket.userName);

    users.forEach((user) => {
      if (user === socket.userName) {
        users.delete(user);

        io.emit("userLeft", user);

        io.emit("userList", Array.from(users));
      }
    });
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server is now running on http://localhost:${PORT}`);
});