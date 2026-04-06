const mongoose = require('mongoose');

// Sub-schema for vessel snapshot
const VesselSnapshotSchema = new mongoose.Schema({
  id:       { type: Number, required: true },
  name:     { type: String, required: true },
  volumeMl: { type: Number, required: true },
}, { _id: false }); // no separate _id for sub-docs

const WaterLogSchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,   // indexed for fast user queries
  },
  date: {
    type:     String,   // "YYYY-MM-DD" — for easy day filtering
    required: true,
    index:    true,
  },
  amount: {
    type:     Number,
    required: [true, 'Amount is required'],
    min:      [1, 'Amount must be at least 1ml'],
    max:      [5000, 'Amount cannot exceed 5000ml'],
  },
  glass: {
    type:     VesselSnapshotSchema,
    required: true,
  },
  jar: {
    type:     VesselSnapshotSchema,
    required: true,
  },
}, { timestamps: true }); // createdAt = exact timestamp of sip

// Compound index: fast lookup of user + date
WaterLogSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('WaterLog', WaterLogSchema);