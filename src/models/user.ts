import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  data: Map<string, string>;
}

const UserSchema: Schema = new Schema({
  data: {
    type: Map,
    of: String,
    required: true,
  },
}, { timestamps: true });

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
