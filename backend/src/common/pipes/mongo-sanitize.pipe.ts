import { Injectable, PipeTransform } from '@nestjs/common';
import { sanitizeMongoInput } from '../utils/mongo-sanitize';

/**
 * Global pipe registered before the ValidationPipe: strips the keys a Mongo filter
 * would read as an operator (`$gt`) or as a path (`a.b`) from body, query and params.
 * The DTOs reject what they do not know, but the Mixed fields (custom field values,
 * view config, whiteboard elements, webhook payload) have no whitelist of their own.
 */
@Injectable()
export class MongoSanitizePipe implements PipeTransform {
  transform(value: unknown): unknown {
    return sanitizeMongoInput(value);
  }
}
