const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { sendOTP } = require('../services/emailService');

// Generate a 6-digit OTP
const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// @route   POST api/auth/register
// @desc    Register user & send OTP
// @access  Public
router.post('/register', async (req, res) => {
    console.log('Register request body:', req.body);
    const { firstName, email, password } = req.body;

    try {
        let user = await User.findOne({ email });

        if (user && user.isVerified) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        // If user exists but is not verified, update their info
        if (user && !user.isVerified) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            user.firstName = firstName;
            await user.save();
        } else {
            user = new User({
                firstName,
                email,
                password,
                isVerified: false
            });

            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            await user.save();
        }

        // Delete any previous OTPs for this email
        await Otp.deleteMany({ email });

        // Generate and store hashed OTP
        const otp = generateOTP();
        const hashedOtp = await bcrypt.hash(otp, 10);
        await Otp.create({ email, otp: hashedOtp });

        // Send OTP email
        try {
            await sendOTP(email, otp);
        } catch (emailErr) {
            console.error('Email sending failed:', emailErr.message);
            return res.status(500).json({ msg: 'Failed to send verification email. Please try again later.' });
        }

        res.json({ msg: 'OTP sent to your email', email });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route   POST api/auth/verify-otp
// @desc    Verify email OTP
// @access  Public
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    try {
        const otpRecord = await Otp.findOne({ email });

        if (!otpRecord) {
            return res.status(400).json({ msg: 'OTP expired or not found. Please request a new one.' });
        }

        const isMatch = await bcrypt.compare(otp, otpRecord.otp);

        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid OTP. Please try again.' });
        }

        // Mark user as verified
        await User.findOneAndUpdate({ email }, { isVerified: true });

        // Clean up OTP
        await Otp.deleteMany({ email });

        res.json({ msg: 'Email verified successfully! You can now log in.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/resend-otp
// @desc    Resend OTP email
// @access  Public
router.post('/resend-otp', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ msg: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ msg: 'Email is already verified' });
        }

        // Delete old OTPs and create new one
        await Otp.deleteMany({ email });

        const otp = generateOTP();
        const hashedOtp = await bcrypt.hash(otp, 10);
        await Otp.create({ email, otp: hashedOtp });

        await sendOTP(email, otp);

        res.json({ msg: 'New OTP sent to your email' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/forgot-password
// @desc    Send OTP for password reset
// @access  Public
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ msg: 'No account found with that email' });
        }

        // Delete old OTPs and create new one
        await Otp.deleteMany({ email });

        const otp = generateOTP();
        const hashedOtp = await bcrypt.hash(otp, 10);
        await Otp.create({ email, otp: hashedOtp });

        try {
            await sendOTP(email, otp, 'reset');
        } catch (emailErr) {
            console.error('Email sending failed:', emailErr.message);
            return res.status(500).json({ msg: 'Failed to send password reset email. Please try again later.' });
        }

        res.json({ msg: 'Password reset code sent to your email' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route   POST api/auth/reset-password
// @desc    Reset password using OTP
// @access  Public
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;

    try {
        const otpRecord = await Otp.findOne({ email });

        if (!otpRecord) {
            return res.status(400).json({ msg: 'OTP expired or not found. Please request a new one.' });
        }

        const isMatch = await bcrypt.compare(otp, otpRecord.otp);

        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid reset code. Please try again.' });
        }

        // Update user's password
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        // Clean up OTP
        await Otp.deleteMany({ email });

        res.json({ msg: 'Password reset successfully! You can now log in.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        let user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password match:', isMatch);

        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // Check if user is verified
        if (!user.isVerified) {
            return res.status(403).json({ msg: 'Please verify your email first', needsVerification: true, email });
        }

        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: 360000 },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/auth/user
// @desc    Get user data
// @access  Private
router.get('/user', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
    const { firstName, businessName, email } = req.body;
    console.log('Update Profile Request:', { userId: req.user.id, body: req.body });

    // Build user object
    const profileFields = {};
    if (firstName) profileFields.firstName = firstName;
    if (businessName) profileFields.businessName = businessName;
    if (email) profileFields.email = email;

    try {
        let user = await User.findById(req.user.id);
        console.log('Found user:', user ? user.email : 'No user found');

        if (!user) return res.status(404).json({ msg: 'User not found' });

        user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: profileFields },
            { new: true }
        ).select('-password');

        console.log('Updated user:', user);

        res.json(user);
    } catch (err) {
        console.error('Profile update error:', err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/auth/password
// @desc    Update user password
// @access  Private
router.put('/password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        let user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ msg: 'User not found' });

        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid current password' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        await user.save();

        res.json({ msg: 'Password updated successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
