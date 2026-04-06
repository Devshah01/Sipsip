const mongoose = require('mongoose');

const VesselSchema = new mongoose.Schema({
  id:       { type: Number, required: true },
  name:     { type: String, required: true },
  volumeMl: { type: Number, required: true },
}, { _id: false });

const VesselSettingsSchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    unique:   true,   // one settings doc per user
  },
  selectedGlass: {
    type:    VesselSchema,
    default: { id: 0, name: 'Hex Facet', volumeMl: 250 },
  },
  selectedJar: {
    type:    VesselSchema,
    default: { id: 0, name: 'Amphora', volumeMl: 2000 },
  },
}, { timestamps: true });

module.exports = mongoose.model('VesselSettings', VesselSettingsSchema);