import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export interface HealthStatus {
  status: 'ok';
  db: 'up' | 'down';
}

@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  check(): HealthStatus {
    return {
      status: 'ok',
      db: this.connection.readyState === 1 ? 'up' : 'down',
    };
  }
}
