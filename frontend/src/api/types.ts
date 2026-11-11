import type { components, paths } from './schema';

/**
 * Convenção da API: toda resposta de documento também traz id, createdAt e
 * updatedAt (está na descrição do contrato), que o Swagger não declara nos
 * modelos do Mongoose.
 */
export type Doc<T> = T & { id: string; createdAt: string; updatedAt: string };

/**
 * O Swagger descreve valor livre (campo personalizado, linha do histórico) como
 * objeto vazio. O contrato aceita qualquer JSON ali, então as chaves listadas
 * voltam a ser `unknown` sem que nenhum tipo da API seja reescrito à mão.
 */
type FreeJson<T, K extends keyof T> = Omit<T, K> & { [P in K]: unknown };

/** Igual ao FreeJson, para as chaves que o contrato declara opcionais. */
type FreeJsonOptional<T, K extends keyof T> = Omit<T, K> & { [P in K]?: unknown };

export type AuthUser = components['schemas']['AuthUserDto'];
export type AuthSession = components['schemas']['AuthResponseDto'];
export type ApiErrorBody = components['schemas']['ApiErrorDto'];
export type Workspace = Doc<components['schemas']['Workspace']>;
export type AcceptedInvite = components['schemas']['AcceptedInviteDto'];
export type CreateWorkspaceInput = components['schemas']['CreateWorkspaceDto'];
export type LoginInput = components['schemas']['LoginDto'];
export type RegisterInput = components['schemas']['RegisterDto'];
export type AcceptInviteInput = components['schemas']['AcceptInviteDto'];
export type WorkspaceTree = components['schemas']['WorkspaceTreeDto'];
export type TreeSpace = components['schemas']['TreeSpaceDto'];
export type TreeFolder = components['schemas']['TreeFolderDto'];
export type TreeList = components['schemas']['TreeListDto'];
export type InboxCounts = components['schemas']['InboxCountsDto'];

export type WorkspaceRole = components['schemas']['WorkspaceWithRoleDto']['role'];
export type AssignableRole = components['schemas']['CreateInviteDto']['role'];
export type MemberStatus = components['schemas']['WorkspaceMemberWithUserDto']['status'];

/** Workspace com o papel de quem pediu; o front esconde o que o papel não permite. */
export interface WorkspaceDetail {
  workspace: Workspace;
  role: WorkspaceRole;
}

export type WorkspaceMemberItem = components['schemas']['WorkspaceMemberWithUserDto'];
export type MemberUser = components['schemas']['MemberUserDto'];
export type WorkspaceInvite = Doc<components['schemas']['Invite']>;
export type Team = Doc<components['schemas']['Team']>;
export type UserSession = components['schemas']['SessionDto'];
export type NotificationPreferences = components['schemas']['NotificationPreferencesDto'];
export type NotificationChannels = components['schemas']['NotificationChannelsStateDto'];
export type NotificationKind = keyof NotificationPreferences;

export type UpdateProfileInput = components['schemas']['UpdateProfileDto'];
export type ChangePasswordInput = components['schemas']['ChangePasswordDto'];
export type UpdateWorkspaceInput = components['schemas']['UpdateWorkspaceDto'];
export type CreateInviteInput = components['schemas']['CreateInviteDto'];
export type CreateTeamInput = components['schemas']['CreateTeamDto'];
export type UpdateTeamInput = components['schemas']['UpdateTeamDto'];
export type UpdateNotificationSettingsInput =
  components['schemas']['UpdateNotificationSettingsDto'];
export type UserTheme = NonNullable<UpdateProfileInput['theme']>;

/* Hierarquia: Spaces, Folders, Lists, statuses e compartilhamento ------- */

export type Space = Doc<components['schemas']['Space']>;
export type Folder = Doc<components['schemas']['Folder']>;
export type ListNode = Doc<components['schemas']['List']>;
export type CreateSpaceInput = components['schemas']['CreateSpaceDto'];
export type UpdateSpaceInput = components['schemas']['UpdateSpaceDto'];
export type CreateFolderInput = components['schemas']['CreateFolderDto'];
export type UpdateFolderInput = components['schemas']['UpdateFolderDto'];
export type MoveFolderInput = components['schemas']['MoveFolderDto'];
export type CreateListInput = components['schemas']['CreateListDto'];
export type UpdateListInput = components['schemas']['UpdateListDto'];
export type MoveListInput = components['schemas']['MoveListDto'];
export type ReorderInput = components['schemas']['ReorderDto'];
export type StatusTemplate = NonNullable<CreateSpaceInput['statusTemplate']>;

export type Status = components['schemas']['Status'];
export type StatusGroup = Status['group'];
export type StatusSet = Doc<components['schemas']['StatusSet']>;
export type StatusInput = components['schemas']['StatusDto'];
export type CreateStatusSetInput = components['schemas']['CreateStatusSetDto'];
export type UpdateStatusSetInput = components['schemas']['UpdateStatusSetDto'];
export type EffectiveStatuses = components['schemas']['EffectiveStatusesDto'];
export type EffectiveStatus = components['schemas']['EffectiveStatusDto'];
export type StatusSource = EffectiveStatuses['source'];

export type Permission = Doc<components['schemas']['Permission']>;
export type ShareInput = components['schemas']['ShareDto'];
export type PermissionLevel = ShareInput['level'];
export type ShareableResourceType = ShareInput['resourceType'];
export type PrincipalType = ShareInput['principalType'];

export type TrashItem = components['schemas']['TrashItemDto'];
export type TrashEntityType = TrashItem['entityType'];

/* Tarefas --------------------------------------------------------------- */

export type Task = Doc<
  Omit<components['schemas']['TaskListItemDto'], 'customFields'> & {
    customFields: TaskFieldValue[];
  }
>;
export type TaskPriority = NonNullable<Task['priority']>;
export type TaskType = Task['type'];
export type CreateTaskInput = components['schemas']['CreateTaskDto'];
export type UpdateTaskInput = components['schemas']['UpdateTaskDto'];
export type MoveTaskInput = components['schemas']['MoveTaskDto'];
export type BulkTasksInput = components['schemas']['BulkTasksDto'];
export type BulkChanges = components['schemas']['BulkChangesDto'];
export type BulkResult = components['schemas']['BulkResultDto'];
export type Tag = Doc<components['schemas']['Tag']>;

/**
 * Parâmetros aceitos por GET /tasks/query, direto do contrato. Só os filtros de
 * campo personalizado trocam de tipo: eles viajam como JSON na query string.
 */
export type TaskQueryParams = Omit<
  NonNullable<paths['/api/v1/workspaces/{wsId}/tasks/query']['get']['parameters']['query']>,
  'fieldFilters'
> & { fieldFilters?: FieldFilter[] };

/** Grupo da consulta com as tarefas já no formato de documento. */
export type TaskGroup = Omit<components['schemas']['TaskGroupDto'], 'items'> & { items: Task[] };

export type TaskQueryResult = Omit<
  components['schemas']['TaskQueryResultDto'],
  'items' | 'groups'
> & { items?: Task[]; groups?: TaskGroup[] };

/** Tarefa do GET /tasks/:idOrCustomId: tudo que o painel abre de uma vez. */
export type TaskDetail = Doc<
  Omit<components['schemas']['TaskDetailDto'], 'customFields' | 'fields'> & {
    customFields: TaskFieldValue[];
    fields: CustomField[];
  }
>;
export type TaskProgress = components['schemas']['ProgressDto'];
export type CustomField = Doc<components['schemas']['CustomField']>;
export type SecondaryListInput = components['schemas']['SecondaryListDto'];
export type CreateTagInput = components['schemas']['CreateTagDto'];

/** JSON do editor de texto rico; null quando a descrição está vazia. */
export type TaskDescription = TaskDetail['description'];

/* Checklists ------------------------------------------------------------ */

export type Checklist = Doc<components['schemas']['Checklist']>;
export type ChecklistItem = components['schemas']['ChecklistItem'] & { id: string };
export type CreateChecklistInput = components['schemas']['CreateChecklistDto'];
export type UpdateChecklistInput = components['schemas']['UpdateChecklistDto'];
export type CreateChecklistItemInput = components['schemas']['CreateChecklistItemDto'];
export type UpdateChecklistItemInput = components['schemas']['UpdateChecklistItemDto'];

/* Tempo ----------------------------------------------------------------- */

export type TimeEntry = Doc<components['schemas']['TimeEntry']>;
export type TimerState = Omit<components['schemas']['TimerStateDto'], 'entry'> & {
  entry: TimeEntry | null;
};
export type TimerResult = Omit<components['schemas']['TimerResultDto'], 'entry' | 'stopped'> & {
  entry: TimeEntry;
  stopped: TimeEntry | null;
};
export type CreateTimeEntryInput = components['schemas']['CreateTimeEntryDto'];
export type UpdateTimeEntryInput = components['schemas']['UpdateTimeEntryDto'];

/* Colaboração: comentários, anexos, dependências e histórico ------------- */

export type Comment = Doc<components['schemas']['Comment']>;
export type CommentReaction = components['schemas']['CommentReaction'];
export type CreateCommentInput = components['schemas']['CreateCommentDto'];
export type UpdateCommentInput = components['schemas']['UpdateCommentDto'];

/** Comentário raiz com as respostas dele, como GET /tasks/:id/comments devolve. */
export type CommentThread = Omit<
  components['schemas']['CommentThreadDto'],
  'comment' | 'replies'
> & { comment: Comment; replies: Comment[] };

export type Attachment = Doc<components['schemas']['Attachment']>;

export type TaskDependency = Doc<components['schemas']['TaskDependency']>;
export type DependencyType = TaskDependency['type'];
export type CreateDependencyInput = components['schemas']['CreateDependencyDto'];

export type ActivityChange = FreeJson<components['schemas']['ActivityChange'], 'from' | 'to'>;
export type Activity = Doc<
  Omit<components['schemas']['Activity'], 'changes'> & { changes: ActivityChange[] }
>;
export type ActivityAction = Activity['action'];

/* Campos personalizados -------------------------------------------------- */

export type CustomFieldType = CustomField['type'];
export type CustomFieldScope = CustomField['scope'];
export type CustomFieldConfig = components['schemas']['CustomFieldConfig'];
export type CustomFieldOption = components['schemas']['CustomFieldOption'];
export type CreateCustomFieldInput = components['schemas']['CreateCustomFieldDto'];
export type UpdateCustomFieldInput = components['schemas']['UpdateCustomFieldDto'];

/** Valor de um campo na tarefa, como a API devolve (fórmula já calculada). */
export type TaskFieldValue = FreeJson<components['schemas']['TaskCustomFieldValue'], 'value'>;

/** Valor de um campo no corpo de escrita da tarefa. */
export type TaskFieldInput = FreeJsonOptional<components['schemas']['TaskCustomFieldDto'], 'value'>;

export type FieldFilter = FreeJsonOptional<components['schemas']['FieldFilterDto'], 'value'>;
export type FieldFilterOp = FieldFilter['op'];

/* Recorrência ------------------------------------------------------------ */

export type TaskRecurrence = components['schemas']['TaskRecurrence'];
export type TaskRecurrenceInput = components['schemas']['TaskRecurrenceDto'];
export type RecurrenceMode = TaskRecurrence['mode'];

/* Workload --------------------------------------------------------------- */

export type WorkloadResult = components['schemas']['WorkloadResultDto'];
export type WorkloadMember = components['schemas']['WorkloadMemberDto'];
export type WorkloadMetric = WorkloadResult['metric'];

/** Escopo das consultas por local (tarefas, workload e feed de atividade). */
export type TaskLocation = NonNullable<TaskQueryParams['location']>;

/* Views ----------------------------------------------------------------- */

export type View = Doc<components['schemas']['View']>;
export type ViewType = View['type'];
export type ViewLocationType = View['locationType'];
export type ViewConfig = Omit<components['schemas']['ViewConfigDto'], 'filters'> & {
  filters?: TaskFilters;
};
export type TaskFilters = Omit<
  NonNullable<components['schemas']['ViewConfigDto']['filters']>,
  'fieldFilters'
> & { fieldFilters?: FieldFilter[] };
export type ViewGroupBy = NonNullable<ViewConfig['groupBy']>;
export type ViewSortBy = NonNullable<ViewConfig['sortBy']>;
export type CreateViewInput = components['schemas']['CreateViewDto'];
export type UpdateViewInput = components['schemas']['UpdateViewDto'];
export type ViewColumn = components['schemas']['ViewColumnDto'];

/* Inbox, lembretes, favoritos e busca --------------------------------------- */

/** Entrada do Inbox; `data` é JSON livre no contrato. */
export type Notification = Doc<FreeJson<components['schemas']['Notification'], 'data'>>;
export type NotificationType = Notification['type'];
export type NotificationBucket = Notification['bucket'];
export type NotificationEntityType = Notification['entityType'];
export type InboxTab = NonNullable<
  NonNullable<paths['/api/v1/workspaces/{wsId}/inbox']['get']['parameters']['query']>['tab']
>;
export type AssignedCommentStatus = NonNullable<
  NonNullable<
    paths['/api/v1/workspaces/{wsId}/assigned-comments']['get']['parameters']['query']
  >['status']
>;

export type Reminder = Doc<components['schemas']['Reminder']>;
export type ReminderRecurrence = Reminder['recurrence'];
export type CreateReminderInput = components['schemas']['CreateReminderDto'];
export type UpdateReminderInput = components['schemas']['UpdateReminderDto'];
export type ReminderStatus = NonNullable<
  NonNullable<paths['/api/v1/workspaces/{wsId}/reminders']['get']['parameters']['query']>['status']
>;

export type FavoriteItem = components['schemas']['FavoriteItemDto'];
export type FavoriteEntity = components['schemas']['FavoriteEntityDto'];
export type FavoriteEntityType = FavoriteItem['entityType'];
export type RecentItem = components['schemas']['RecentItemDto'];
export type CreateFavoriteInput = components['schemas']['CreateFavoriteDto'];

export type SearchResult = components['schemas']['SearchResultDto'];
export type SearchResults = components['schemas']['SearchResultsDto'];
export type SearchType = SearchResult['types'][number];
export type SearchTaskHit = components['schemas']['SearchTaskHitDto'];
export type SearchListHit = components['schemas']['SearchListHitDto'];
export type SearchSpaceHit = components['schemas']['SearchSpaceHitDto'];
export type SearchFolderHit = components['schemas']['SearchFolderHitDto'];
export type SearchCommentHit = components['schemas']['SearchCommentHitDto'];
export type SearchPageHit = components['schemas']['SearchPageHitDto'];
export type SearchMessageHit = components['schemas']['SearchMessageHitDto'];
export type SearchUserHit = components['schemas']['SearchUserHitDto'];

/** Minhas tarefas: as cinco seções por prazo, no fuso do usuário. */
export type MyTasksResult = Omit<components['schemas']['MyTasksResultDto'], 'sections'> & {
  sections: MyTasksSections;
};
export type MyTasksSections = Record<DueBucket, Task[]>;
export type DueBucket = keyof components['schemas']['MyTasksSectionsDto'];

/* Timesheets ------------------------------------------------------------ */

export type Timesheet = components['schemas']['TimesheetDto'];
export type TimesheetRow = components['schemas']['TimesheetRowDto'];
export type TimesheetTotals = components['schemas']['TimesheetTotalsDto'];
export type TimesheetApproval = components['schemas']['TimesheetApprovalDto'];
export type TimesheetSubmitResult = components['schemas']['TimesheetSubmitResultDto'];
export type TimesheetReviewResult = components['schemas']['TimesheetReviewResultDto'];
export type ApprovalStatus = Timesheet['approvalStatus'];

/* Dashboards ------------------------------------------------------------ */

export type Dashboard = Doc<
  Omit<components['schemas']['Dashboard'], 'cards'> & { cards: DashboardCard[] }
>;

/** Card salvo; `config` é JSON livre no contrato e vira CardConfig aqui. */
export type DashboardCard = Omit<components['schemas']['DashboardCard'], 'config'> & {
  config: CardConfig;
};
export type CardType = DashboardCard['type'];
export type CardConfig = components['schemas']['CardConfigDto'];
export type CardInput = Omit<components['schemas']['CardDto'], 'config'> & {
  config?: CardConfig;
};
export type CreateDashboardInput = components['schemas']['CreateDashboardDto'];
export type UpdateDashboardInput = Omit<components['schemas']['UpdateDashboardDto'], 'cards'> & {
  cards?: CardInput[];
};

/** Resposta do card; `data` muda com o tipo e é lida pelos modelos abaixo. */
export type CardDataResponse = Omit<components['schemas']['CardDataResponseDto'], 'data'> & {
  data: unknown;
};
export type CardTasksByStatus = components['schemas']['CardTasksByStatusDto'];
export type CardTasksByAssignee = components['schemas']['CardTasksByAssigneeDto'];
export type CardBurndown = components['schemas']['CardBurndownDto'];
export type CardBurnup = components['schemas']['CardBurnupDto'];
export type CardTimeByClient = components['schemas']['CardTimeByClientDto'];
export type CardTimeByUser = components['schemas']['CardTimeByUserDto'];
export type CardBillable = components['schemas']['CardBillableDto'];
export type CardTaskList = components['schemas']['CardTaskListDto'];
export type CardTaskRow = components['schemas']['CardTaskRowDto'];
export type CardCalculator = components['schemas']['CardCalculatorDto'];
export type CalculatorTaskField = NonNullable<CardConfig['taskField']>;
export type CalculatorOp = NonNullable<CardConfig['op']>;

/* Automações ------------------------------------------------------------ */

export type Automation = Doc<
  Omit<components['schemas']['Automation'], 'trigger' | 'conditions' | 'actions'> & {
    trigger: AutomationTrigger;
    conditions: AutomationCondition[];
    actions: AutomationAction[];
  }
>;
export type AutomationTrigger = FreeJson<components['schemas']['AutomationTrigger'], 'params'>;
export type AutomationCondition = FreeJson<components['schemas']['AutomationCondition'], 'value'>;
export type AutomationAction = FreeJson<components['schemas']['AutomationAction'], 'params'>;
export type TriggerType = AutomationTrigger['type'];
export type ActionType = AutomationAction['type'];
export type ConditionOp = AutomationCondition['op'];
export type AutomationLocationType = Automation['locationType'];
export type TriggerParams = components['schemas']['TriggerParamsDto'];
export type ActionParams = FreeJsonOptional<components['schemas']['ActionParamsDto'], 'value'>;
export type CreateAutomationInput = Omit<
  components['schemas']['CreateAutomationDto'],
  'trigger' | 'conditions' | 'actions'
> & {
  trigger: AutomationTriggerInput;
  conditions?: AutomationConditionInput[];
  actions: AutomationActionInput[];
};
export type UpdateAutomationInput = Partial<
  Omit<CreateAutomationInput, 'locationType' | 'locationId'>
>;
export type AutomationTriggerInput = Omit<components['schemas']['TriggerDto'], 'params'> & {
  params?: TriggerParams;
};
export type AutomationConditionInput = FreeJsonOptional<
  components['schemas']['ConditionDto'],
  'value'
>;
export type AutomationActionInput = Omit<components['schemas']['ActionDto'], 'params'> & {
  params?: ActionParams;
};
export type AutomationResult = Omit<components['schemas']['AutomationResultDto'], 'automation'> & {
  automation: Automation;
};
export type AutomationRecipe = Omit<
  components['schemas']['AutomationRecipeDto'],
  'trigger' | 'conditions' | 'actions'
> & {
  trigger: AutomationTriggerInput;
  conditions: AutomationConditionInput[];
  actions: AutomationActionInput[];
};
export type AutomationRun = Doc<components['schemas']['AutomationRun']>;
export type AutomationRunStatus = AutomationRun['status'];

/* Templates ------------------------------------------------------------- */

export type Template = Doc<components['schemas']['Template']>;
export type TemplateType = Template['type'];
export type CreateTemplateInput = components['schemas']['CreateTemplateDto'];
export type ApplyTemplateInput = components['schemas']['ApplyTemplateDto'];
export type TemplateTargetType = NonNullable<ApplyTemplateInput['targetType']>;
export type AppliedTemplate = components['schemas']['AppliedTemplateDto'];

/* Chat: canais, DMs, mensagens e threads --------------------------------- */

export type Channel = Doc<components['schemas']['Channel']>;
export type ChannelType = Channel['type'];
export type ChannelLocationType = Channel['locationType'];
export type Message = Doc<FreeJson<components['schemas']['Message'], 'body'>>;
export type MessageReaction = components['schemas']['MessageReaction'];
export type CreateChannelInput = components['schemas']['CreateChannelDto'];
export type UpdateChannelInput = components['schemas']['UpdateChannelDto'];
export type CreateDmInput = components['schemas']['CreateDmDto'];
export type ChannelMembersInput = components['schemas']['ChannelMembersDto'];
export type CreateMessageInput = components['schemas']['CreateMessageDto'];
export type UpdateMessageInput = components['schemas']['UpdateMessageDto'];
export type ChannelRead = components['schemas']['ChannelReadDto'];
export type ChatActivity = components['schemas']['ChatActivityDto'];
export type ChannelActivity = components['schemas']['ChannelActivityDto'];
export type MessageToTaskResult = Omit<components['schemas']['MessageToTaskResultDto'], 'task'> & {
  task: Task;
};

/* Docs ------------------------------------------------------------------- */

export type WorkspaceDoc = Doc<components['schemas']['Doc']>;
export type DocLocationType = WorkspaceDoc['locationType'];
export type DocHubTab = NonNullable<
  NonNullable<paths['/api/v1/workspaces/{wsId}/docs']['get']['parameters']['query']>['tab']
>;
export type CreateDocInput = components['schemas']['CreateDocDto'];
export type UpdateDocInput = components['schemas']['UpdateDocDto'];
export type ShareDocResult = Omit<components['schemas']['ShareDocResultDto'], 'doc'> & {
  doc: WorkspaceDoc;
};
export type DocPage = Doc<components['schemas']['DocPage']>;
export type CreatePageInput = components['schemas']['CreatePageDto'];
export type UpdatePageInput = components['schemas']['UpdatePageDto'];
export type MovePageInput = components['schemas']['MovePageDto'];
export type DocPageVersion = Doc<components['schemas']['DocPageVersion']>;
export type CreatePageCommentInput = components['schemas']['CreatePageCommentDto'];
export type PageCommentThread = Omit<
  components['schemas']['PageCommentThreadDto'],
  'comment' | 'replies'
> & { comment: Comment; replies: Comment[] };
export type PublicDoc = Omit<components['schemas']['PublicDocDto'], 'doc' | 'pages'> & {
  doc: WorkspaceDoc;
  pages: DocPage[];
};

/* Planner e calendário --------------------------------------------------- */

export type CalendarEvent = Doc<components['schemas']['CalendarEvent']>;
export type CalendarSource = CalendarEvent['source'];
export type CreateEventInput = components['schemas']['CreateCalendarEventDto'];
export type UpdateEventInput = components['schemas']['UpdateCalendarEventDto'];
export type CreateTimeBlockInput = components['schemas']['CreateTimeBlockDto'];

/** O planner devolve o documento cru da tarefa, sem as contagens de subtarefa. */
export type PlannerTask = Doc<
  Omit<components['schemas']['Task'], 'description' | 'customFields'> & {
    description: unknown;
    customFields: TaskFieldValue[];
  }
>;

export type PlannerResult = Omit<
  components['schemas']['PlannerResultDto'],
  'events' | 'dueTasks' | 'unscheduledTasks'
> & { events: CalendarEvent[]; dueTasks: PlannerTask[]; unscheduledTasks: PlannerTask[] };

/* Metas ------------------------------------------------------------------ */

export type GoalFolder = Doc<components['schemas']['GoalFolder']>;
export type Goal = Doc<components['schemas']['Goal']>;
export type GoalTarget = Doc<components['schemas']['Target']>;
export type TargetType = GoalTarget['type'];
export type GoalView = Omit<components['schemas']['GoalViewDto'], 'goal' | 'targets'> & {
  goal: Goal;
  targets: GoalTarget[];
};
export type TargetResult = Omit<components['schemas']['TargetResultDto'], 'target'> & {
  target: GoalTarget;
};
export type CreateGoalFolderInput = components['schemas']['CreateGoalFolderDto'];
export type UpdateGoalFolderInput = components['schemas']['UpdateGoalFolderDto'];
export type CreateGoalInput = components['schemas']['CreateGoalDto'];
export type UpdateGoalInput = components['schemas']['UpdateGoalDto'];
export type CreateTargetInput = components['schemas']['CreateTargetDto'];
export type UpdateTargetInput = components['schemas']['UpdateTargetDto'];

/* Formulários ------------------------------------------------------------ */

export type WorkspaceForm = Doc<components['schemas']['Form']>;
export type FormFieldModel = components['schemas']['FormField'];
export type FormFieldKind = FormFieldModel['type'];
export type FormFieldOption = components['schemas']['FormFieldOption'];
export type FormConditionModel = FreeJson<components['schemas']['FormCondition'], 'value'>;
export type FormConditionOp = FormConditionModel['op'];
export type FormFieldInput = components['schemas']['FormFieldDto'];
export type FormConditionInput = FreeJsonOptional<
  components['schemas']['FormConditionDto'],
  'value'
>;
export type CreateFormInput = Omit<components['schemas']['CreateFormDto'], 'conditions'> & {
  conditions?: FormConditionInput[];
};
export type UpdateFormInput = Omit<components['schemas']['UpdateFormDto'], 'conditions'> & {
  conditions?: FormConditionInput[];
};
/**
 * Corpo cru do contrato. O Swagger descreve `conditions[].value` como objeto
 * vazio, então a conversão do rascunho para esse formato fica num ponto só, no
 * api.ts do módulo.
 */
export type CreateFormBody = components['schemas']['CreateFormDto'];
export type UpdateFormBody = components['schemas']['UpdateFormDto'];
export type FormResult = Omit<components['schemas']['FormResultDto'], 'form'> & {
  form: WorkspaceForm;
};
export type PublicFormField = components['schemas']['PublicFormFieldDto'];
export type PublicFormCondition = FreeJsonOptional<
  components['schemas']['PublicFormConditionDto'],
  'value'
>;
export type PublicForm = Omit<components['schemas']['PublicFormDto'], 'conditions'> & {
  conditions: PublicFormCondition[];
};
export type SubmitFormResult = components['schemas']['SubmitFormResultDto'];

/* Sprints ---------------------------------------------------------------- */

export type SprintFolder = Doc<components['schemas']['SprintFolder']>;
export type SprintFolderView = Omit<
  components['schemas']['SprintFolderViewDto'],
  'sprintFolder' | 'sprints'
> & { sprintFolder: SprintFolder; sprints: ListNode[] };
export type CloseSprintResult = Omit<
  components['schemas']['CloseSprintResultDto'],
  'sprint' | 'nextSprint'
> & { sprint: ListNode; nextSprint: ListNode };
export type CreateSprintFolderInput = components['schemas']['CreateSprintFolderDto'];
export type UpdateSprintFolderInput = components['schemas']['UpdateSprintFolderDto'];
export type CreateSprintInput = components['schemas']['CreateSprintDto'];

/* IA (Grok) -------------------------------------------------------------- */

export type AiSummarizeEntityType = components['schemas']['AiSummarizeDto']['entityType'];
export type AiSummarizeInput = components['schemas']['AiSummarizeDto'];
export type AiSummary = components['schemas']['AiSummaryResultDto'];
export type ProposedTask = components['schemas']['ProposedTaskDto'];
export type AiTaskProposal = Omit<components['schemas']['AiTaskProposalResultDto'], 'tasks'> & {
  tasks: ProposedTask[];
};
export type AiConfirmResult = Omit<components['schemas']['AiConfirmResultDto'], 'created'> & {
  created: Task[];
};
export type AiWriteAction = components['schemas']['AiWriteDto']['action'];
export type AiWriteResult = components['schemas']['AiWriteResultDto'];
export type AiUsageSummary = components['schemas']['AiUsageSummaryDto'];
export type AiAgent = Doc<FreeJson<components['schemas']['AiAgent'], 'config'>>;
export type AiAgentType = AiAgent['type'];
export type CreateAiAgentInput = components['schemas']['CreateAiAgentDto'];
export type UpdateAiAgentInput = components['schemas']['UpdateAiAgentDto'];

/* Quadros brancos -------------------------------------------------------- */

/**
 * `elements` é Mixed no contrato (o Swagger descreve objeto vazio): o quadro
 * guarda o elemento normalizado do servidor, tipado em features/whiteboards.
 */
export type Whiteboard = Doc<Omit<components['schemas']['Whiteboard'], 'elements'>> & {
  elements: unknown[];
};
export type WhiteboardLocationType = Whiteboard['locationType'];
export type CreateWhiteboardInput = components['schemas']['CreateWhiteboardDto'];
export type UpdateWhiteboardInput = components['schemas']['UpdateWhiteboardDto'];
export type WhiteboardOpKind = components['schemas']['WhiteboardOpDto']['op'];
export type PatchWhiteboardElementsBody = components['schemas']['PatchWhiteboardElementsDto'];
export type ElementTaskResult = Omit<
  components['schemas']['ElementTaskResultDto'],
  'task' | 'whiteboard'
> & { task: Task; whiteboard: Whiteboard };
