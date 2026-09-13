// ProjectRole is a TypeScript "string enum": each member maps to one of these.
// Using string values ('owner' not 0) keeps the values readable wherever they
// get stored — including the Postgres enum column.
export enum ProjectRole {
  OWNER = 'owner',
  COLLABORATOR = 'collaborator',
  VIEWER = 'viewer',
}