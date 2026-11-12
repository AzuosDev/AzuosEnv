import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { InviteAcceptController, InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { Invite, InviteSchema } from './schemas/invite.schema';
import { Team, TeamSchema } from './schemas/team.schema';
import { WorkspaceMember, WorkspaceMemberSchema } from './schemas/workspace-member.schema';
import { Workspace, WorkspaceSchema } from './schemas/workspace.schema';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: WorkspaceMember.name, schema: WorkspaceMemberSchema },
      { name: Invite.name, schema: InviteSchema },
      { name: Team.name, schema: TeamSchema },
    ]),
    MailModule,
    UsersModule,
  ],
  controllers: [
    WorkspacesController,
    MembersController,
    InvitesController,
    InviteAcceptController,
    TeamsController,
  ],
  providers: [WorkspacesService, MembersService, InvitesService, TeamsService],
  exports: [WorkspacesService, MembersService, TeamsService, InvitesService],
})
export class WorkspacesModule {}
