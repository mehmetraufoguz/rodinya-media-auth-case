import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: {
    _id?: string;
    id?: string;
    email?: string;
    sub?: string;
  };
}
