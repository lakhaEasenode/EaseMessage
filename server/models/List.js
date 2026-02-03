const mongoose = require('mongoose');

const ListSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    // Reference to user who created this list
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Array of contact IDs in this list
    contacts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact'
    }],
    // Total count for performance (updated on add/remove)
    contactCount: {
        type: Number,
        default: 0
    },
    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Index for searching lists by name
ListSchema.index({ name: 'text', description: 'text' });

// Index for finding user's lists
ListSchema.index({ userId: 1, isDeleted: 1 });

// Method to add contact to list
ListSchema.methods.addContact = async function (contactId) {
    if (!this.contacts.includes(contactId)) {
        this.contacts.push(contactId);
        this.contactCount = this.contacts.length;
        await this.save();
    }
    return this;
};

// Method to remove contact from list
ListSchema.methods.removeContact = async function (contactId) {
    this.contacts = this.contacts.filter(id => !id.equals(contactId));
    this.contactCount = this.contacts.length;
    await this.save();
    return this;
};

// Method to soft delete
ListSchema.methods.softDelete = function () {
    this.isDeleted = true;
    return this.save();
};

// Static method to find active lists only
ListSchema.statics.findActive = function (query = {}) {
    return this.find({ ...query, isDeleted: false });
};

module.exports = mongoose.model('List', ListSchema);
