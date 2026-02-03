const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
    // Reference to user who owns this contact
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Name fields
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        trim: true
    },

    // Phone fields
    countryCode: {
        type: String,
        required: true,
        default: '+1'
    },
    phoneNumber: {
        type: String,
        required: true,
        trim: true
    },

    // Optional contact info
    email: {
        type: String,
        trim: true,
        lowercase: true
    },

    // Tags for categorization
    tags: [{
        type: String,
        trim: true
    }],

    // Lists this contact belongs to
    lists: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'List'
    }],

    // Opt-in compliance
    optedIn: {
        type: Boolean,
        required: true,
        default: false
    },
    optInSource: {
        type: String,
        enum: ['manual', 'csv', 'api'],
        default: 'manual'
    },
    optInDate: {
        type: Date
    },

    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },

    // Custom attributes for template variables
    customAttributes: {
        type: Map,
        of: String,
        default: {}
    },

    // Conversation Workflow Status
    conversationStatus: {
        type: String,
        enum: ['open', 'pending', 'resolved'],
        default: 'open',
        index: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Compound unique index for userId + countryCode + phoneNumber
// This ensures each user can't have duplicate contacts
ContactSchema.index({ userId: 1, countryCode: 1, phoneNumber: 1 }, { unique: true });

// Index for searching
ContactSchema.index({ userId: 1, firstName: 'text', lastName: 'text' });

// Index for filtering by opt-in status
ContactSchema.index({ userId: 1, optedIn: 1, isDeleted: 1 });

// Virtual for full name
ContactSchema.virtual('fullName').get(function () {
    return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
});

// Method to add to list
ContactSchema.methods.addToList = async function (listId) {
    if (!this.lists.includes(listId)) {
        this.lists.push(listId);
        await this.save();
    }
    return this;
};

// Method to remove from list
ContactSchema.methods.removeFromList = async function (listId) {
    this.lists = this.lists.filter(id => !id.equals(listId));
    await this.save();
    return this;
};

// Method to soft delete
ContactSchema.methods.softDelete = function () {
    this.isDeleted = true;
    return this.save();
};

// Static method to find active contacts only
ContactSchema.statics.findActive = function (query = {}) {
    return this.find({ ...query, isDeleted: false });
};

module.exports = mongoose.model('Contact', ContactSchema);
