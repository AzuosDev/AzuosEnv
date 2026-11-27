import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { escapeRegex } from '../../common/utils/regex';
import { PermissionContext } from '../hierarchy/permission.service';
import { WhatsappProviders } from './providers/whatsapp-providers.service';
import { CreateWaContactDto, UpdateWaContactDto, WaContactQueryDto } from './dto/whatsapp.dto';
import { WaContact, WaContactDocument } from './schemas/wa-contact.schema';
import { WhatsappConnectionsService } from './whatsapp-connections.service';
import { brazilNumberVariants } from './whatsapp-jid';

/** Contacts of the module, with the notes and the tags of the team. */
@Injectable()
export class WhatsappContactsService {
  private readonly logger = new Logger(WhatsappContactsService.name);

  constructor(
    @InjectModel(WaContact.name) private readonly model: Model<WaContact>,
    private readonly connections: WhatsappConnectionsService,
    private readonly providers: WhatsappProviders,
  ) {}

  contactNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'WHATSAPP_CONTACT_NOT_FOUND',
      message: 'Contato do WhatsApp não encontrado.',
    });
  }

  async list(
    ctx: PermissionContext,
    query: WaContactQueryDto,
  ): Promise<CursorPage<WaContactDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const term = (query.q ?? '').trim();
    const filter: Record<string, unknown> = { workspaceId: ctx.workspaceId };

    if (term.length > 0) {
      const regex = new RegExp(escapeRegex(term), 'i');

      filter.$or = [{ name: regex }, { profileName: regex }, { waId: regex }];
    }

    if (query.cursor) {
      filter._id = { $lt: decodeObjectIdCursor(query.cursor) };
    }

    const docs = await this.model
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  async require(ctx: PermissionContext, contactId: Types.ObjectId): Promise<WaContactDocument> {
    const contact = await this.model
      .findOne({ _id: contactId, workspaceId: ctx.workspaceId })
      .exec();

    if (!contact) {
      throw this.contactNotFound();
    }

    return contact;
  }

  /** Contact of a conversation read outside a request, as the bot does. */
  async byId(
    workspaceId: Types.ObjectId,
    contactId: Types.ObjectId,
  ): Promise<WaContactDocument | null> {
    return this.model.findOne({ _id: contactId, workspaceId }).exec();
  }

  /** Contacts of a page of conversations, by id, in a single query. */
  async byIds(
    workspaceId: Types.ObjectId,
    contactIds: Types.ObjectId[],
  ): Promise<Map<string, WaContactDocument>> {
    if (contactIds.length === 0) {
      return new Map();
    }

    const contacts = await this.model.find({ workspaceId, _id: { $in: contactIds } }).exec();

    return new Map(contacts.map((contact) => [String(contact._id), contact]));
  }

  async create(ctx: PermissionContext, dto: CreateWaContactDto): Promise<WaContactDocument> {
    const waId = await this.resolveWaId(ctx.workspaceId, dto.waId);
    const taken = await this.model.countDocuments({ workspaceId: ctx.workspaceId, waId }).exec();

    if (taken > 0) {
      throw new ConflictException({
        code: 'WHATSAPP_CONTACT_EXISTS',
        message: 'Já existe um contato com este número.',
      });
    }

    return this.model.create({
      workspaceId: ctx.workspaceId,
      waId,
      name: dto.name ?? '',
      tags: dto.tags ?? [],
      notes: dto.notes ?? '',
      spaceId: dto.spaceId ? new Types.ObjectId(dto.spaceId) : null,
      folderId: dto.folderId ? new Types.ObjectId(dto.folderId) : null,
    });
  }

  async update(
    ctx: PermissionContext,
    contactId: Types.ObjectId,
    dto: UpdateWaContactDto,
  ): Promise<WaContactDocument> {
    const contact = await this.require(ctx, contactId);

    if (dto.name !== undefined) {
      contact.name = dto.name;
    }

    if (dto.tags !== undefined) {
      contact.tags = dto.tags;
    }

    if (dto.notes !== undefined) {
      contact.notes = dto.notes;
    }

    if (dto.optOut !== undefined) {
      contact.optOut = dto.optOut;
    }

    if (dto.spaceId !== undefined) {
      contact.spaceId = dto.spaceId ? new Types.ObjectId(dto.spaceId) : null;
    }

    if (dto.folderId !== undefined) {
      contact.folderId = dto.folderId ? new Types.ObjectId(dto.folderId) : null;
    }

    await contact.save();

    return contact;
  }

  async remove(ctx: PermissionContext, contactId: Types.ObjectId): Promise<void> {
    const contact = await this.require(ctx, contactId);

    await this.model.deleteOne({ _id: contact._id }).exec();
  }

  /** Ids of the contacts matching the search; used by the conversation list. */
  async idsMatching(workspaceId: Types.ObjectId, term: string): Promise<Types.ObjectId[]> {
    const regex = new RegExp(escapeRegex(term), 'i');
    const contacts = await this.model
      .find({ workspaceId, $or: [{ name: regex }, { profileName: regex }, { waId: regex }] })
      .select('_id')
      .exec();

    return contacts.map((contact) => contact._id);
  }

  /** Creates the contact of an inbound message, or refreshes the profile name. */
  async upsertFromInbound(
    workspaceId: Types.ObjectId,
    waId: string,
    profileName: string,
    at: Date,
  ): Promise<WaContactDocument> {
    const contact = await this.model
      .findOneAndUpdate(
        { workspaceId, waId },
        {
          $set: { lastInteractionAt: at, ...(profileName ? { profileName } : {}) },
          $setOnInsert: { firstContactAt: at, name: profileName },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    if (!contact) {
      throw this.contactNotFound();
    }

    return contact;
  }

  /**
   * Número que realmente existe no WhatsApp. Um celular brasileiro cadastrado
   * antes do nono dígito continua com o JID de oito, então o número digitado à
   * mão só chega numa das duas formas; qual delas é se pergunta ao provedor
   * antes de abrir a conversa. Sem resposta, o número digitado vale.
   */
  private async resolveWaId(workspaceId: Types.ObjectId, waId: string): Promise<string> {
    const variants = brazilNumberVariants(waId);

    if (variants.length < 2) {
      return waId;
    }

    try {
      const { credentials } = await this.connections.requireCredentials(workspaceId);
      const existing = await this.providers
        .forCredentials(credentials)
        .existingNumbers(credentials, variants);
      // Só serve a forma que o provedor confirmou; qualquer outra resposta é
      // ruído e não vira contato.
      const found = variants.find((variant) => existing.includes(variant));

      if (!found) {
        throw new ConflictException({
          code: 'WHATSAPP_NUMBER_NOT_FOUND',
          message: 'Este número não tem WhatsApp.',
        });
      }

      return found;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      this.logger.warn(
        `Não foi possível conferir o número ${waId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return waId;
    }
  }

  async touch(contactId: Types.ObjectId, at: Date): Promise<void> {
    await this.model.updateOne({ _id: contactId }, { $set: { lastInteractionAt: at } }).exec();
  }
}
