import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { PermissionLevel } from '../hierarchy/permission-levels';
import { PermissionContext } from '../hierarchy/permission.service';
import { CreateTagDto, TagQueryDto, UpdateTagDto } from './dto/tag.dto';
import { Tag, TagDocument } from './schemas/tag.schema';

const DEFAULT_TAG_COLOR = '#2563EB';

@Injectable()
export class TagsService {
  constructor(
    @InjectModel(Tag.name) private readonly model: Model<Tag>,
    private readonly access: HierarchyAccessService,
  ) {}

  async create(ctx: PermissionContext, dto: CreateTagDto): Promise<TagDocument> {
    const space = await this.access.requireSpace(ctx, new Types.ObjectId(dto.spaceId), 'edit');

    return this.model.create({
      workspaceId: ctx.workspaceId,
      spaceId: space._id,
      name: dto.name,
      color: dto.color ?? DEFAULT_TAG_COLOR,
    });
  }

  /** Tags of the Spaces the requester can see. */
  async list(ctx: PermissionContext, query: TagQueryDto): Promise<CursorPage<TagDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const spaceIds = query.spaceId
      ? [(await this.access.requireSpace(ctx, new Types.ObjectId(query.spaceId), 'view'))._id]
      : (await this.access.visibleSpaces(ctx, { includeArchived: true })).map((space) => space._id);

    const filter = query.cursor
      ? {
          workspaceId: ctx.workspaceId,
          spaceId: { $in: spaceIds },
          _id: { $gt: decodeObjectIdCursor(query.cursor) },
        }
      : { workspaceId: ctx.workspaceId, spaceId: { $in: spaceIds } };

    const docs = await this.model
      .find(filter)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  async update(
    ctx: PermissionContext,
    tagId: Types.ObjectId,
    dto: UpdateTagDto,
  ): Promise<TagDocument> {
    const tag = await this.require(ctx, tagId, 'edit');

    if (dto.name !== undefined) {
      tag.name = dto.name;
    }

    if (dto.color !== undefined) {
      tag.color = dto.color;
    }

    return tag.save();
  }

  async remove(ctx: PermissionContext, tagId: Types.ObjectId): Promise<void> {
    const tag = await this.require(ctx, tagId, 'full');

    await tag.deleteOne();
  }

  /** Validates that every tag belongs to the workspace. */
  async requireOwned(workspaceId: Types.ObjectId, tagIds?: string[]): Promise<Types.ObjectId[]> {
    if (!tagIds?.length) {
      return [];
    }

    const ids = [...new Set(tagIds)].map((id) => new Types.ObjectId(id));
    const found = await this.model
      .find({ workspaceId, _id: { $in: ids } })
      .select('_id')
      .exec();

    if (found.length !== ids.length) {
      throw new BadRequestException({
        code: 'INVALID_TAGS',
        message: 'Uma ou mais tags são inválidas para este workspace.',
      });
    }

    return ids;
  }

  private async require(
    ctx: PermissionContext,
    tagId: Types.ObjectId,
    required: PermissionLevel,
  ): Promise<TagDocument> {
    const tag = await this.model.findOne({ _id: tagId, workspaceId: ctx.workspaceId }).exec();

    if (!tag) {
      throw new NotFoundException({ code: 'TAG_NOT_FOUND', message: 'Tag não encontrada.' });
    }

    await this.access.requireSpace(ctx, tag.spaceId, required);

    return tag;
  }
}
