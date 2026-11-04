import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { DocsAccessService } from './docs-access.service';
import { Doc, DocSchema } from './schemas/doc.schema';
import { DocPage, DocPageSchema } from './schemas/doc-page.schema';
import { DocPageVersion, DocPageVersionSchema } from './schemas/doc-page-version.schema';

/**
 * Collections of the docs module. Separate from DocsModule so the search, the
 * favorites and the realtime gateway can read a Doc without a circular dependency.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Doc.name, schema: DocSchema },
      { name: DocPage.name, schema: DocPageSchema },
      { name: DocPageVersion.name, schema: DocPageVersionSchema },
    ]),
    HierarchyModule,
  ],
  providers: [DocsAccessService],
  exports: [MongooseModule, DocsAccessService],
})
export class DocsDataModule {}
