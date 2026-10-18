import { prisma } from '@dct-crm/db';

export type ReportFieldType = 'string' | 'number' | 'date' | 'enum';

export interface ReportField {
  label: string;
  path: string;
  type: ReportFieldType;
  combine?: string[];
}

export interface ReportObject {
  label: string;
  category?: string;
  model: string;
  fields: Record<string, ReportField>;
}

export interface ReportMetadataField {
  key: string;
  label: string;
  type: ReportFieldType;
}

export interface ReportMetadataObject {
  name: string;
  label: string;
  category: string;
  fields: ReportMetadataField[];
}

export interface ReportMetadataRegistry {
  objects: ReportMetadataObject[];
  name?: string;
  label?: string;
  category?: string;
  fields?: ReportMetadataField[];
  object?: ReportMetadataObject;
}

function toMetadataObject(name: string, object: ReportObject): ReportMetadataObject {
  return {
    name,
    label: object.label,
    category: object.category || object.label,
    fields: Object.entries(object.fields).map(([key, field]) => ({
      key,
      label: field.label,
      type: field.type,
    })),
  };
}

export async function getReportMetadataRegistry(
  tenantId: string,
  objectName?: string,
): Promise<ReportMetadataRegistry> {
  const staticObjects = Object.entries(REPORT_OBJECTS).map(([name, object]) =>
    toMetadataObject(name, object),
  );

  const definedObjects = await prisma.objectDefinition.findMany({
    where: { tenantId, isActive: true },
    include: {
      fields: {
        where: { isActive: true, visible: true },
        orderBy: { displayOrder: 'asc' },
      },
    },
    orderBy: { label: 'asc' },
  });

  const staticNames = new Set(staticObjects.map((object) => object.name.toLowerCase()));
  const dynamicObjects = definedObjects
    .filter((object) => !staticNames.has(object.name.toLowerCase()))
    .map((object) => ({
      name: object.name,
      label: object.pluralLabel || object.label,
      category: object.pluralLabel || object.label,
      fields: object.fields.map((field) => ({
        key: field.name,
        label: field.label,
        type: (['number', 'currency', 'decimal'].includes(field.fieldType)
          ? 'number'
          : ['date', 'dateTime'].includes(field.fieldType)
            ? 'date'
            : field.fieldType === 'picklist'
              ? 'enum'
              : 'string') as ReportFieldType,
      })),
    }));

  const objects = [...staticObjects, ...dynamicObjects];

  if (!objectName) {
    return { objects };
  }

  const matched =
    objects.find((object) => object.name === objectName) ||
    objects.find((object) => object.name.toLowerCase() === objectName.toLowerCase());

  if (!matched) {
    throw new Error(`Unknown report object: ${objectName}`);
  }

  return {
    objects,
    name: matched.name,
    label: matched.label,
    category: matched.category,
    fields: matched.fields,
    object: matched,
  };
}

export const REPORT_OBJECTS: Record<string, ReportObject> = {
  Lead: {
    label: 'Leads',
    category: 'Leads',
    model: 'lead',
    fields: {
      id: { label: 'Lead ID', path: 'id', type: 'string' },
      leadNumber: { label: 'Lead Number', path: 'leadNumber', type: 'string' },
      firstName: { label: 'First Name', path: 'firstName', type: 'string' },
      lastName: { label: 'Last Name', path: 'lastName', type: 'string' },
      email: { label: 'Email', path: 'email', type: 'string' },
      phone: { label: 'Phone', path: 'phone', type: 'string' },
      status: { label: 'Status', path: 'status', type: 'enum' },
      source: { label: 'Lead Source', path: 'source', type: 'enum' },
      score: { label: 'Score', path: 'score', type: 'number' },
      budget: { label: 'Budget', path: 'budget', type: 'number' },
      requirements: { label: 'Requirements', path: 'requirements', type: 'string' },
      notes: { label: 'Notes', path: 'notes', type: 'string' },
      createdAt: { label: 'Created Date', path: 'createdAt', type: 'date' },
      updatedAt: { label: 'Updated Date', path: 'updatedAt', type: 'date' },
      ownerId: { label: 'Owner ID', path: 'ownerId', type: 'string' },
      ownerName: { label: 'Owner', path: 'owner.firstName', type: 'string', combine: ['owner.firstName', 'owner.lastName'] },
      ownerEmail: { label: 'Owner Email', path: 'owner.email', type: 'string' },
      projectName: { label: 'Project', path: 'project.name', type: 'string' },
      rrQueueId: { label: 'Round Robin Queue ID', path: 'rrQueueId', type: 'string' },
      rrQueueName: { label: 'Round Robin Queue', path: 'rrQueue.name', type: 'string' },
    },
  },
  SiteVisit: {
    label: 'Site Visits',
    category: 'Site Visits',
    model: 'siteVisit',
    fields: {
      id: { label: 'Site Visit ID', path: 'id', type: 'string' },
      scheduledAt: { label: 'Scheduled Date', path: 'scheduledAt', type: 'date' },
      completedAt: { label: 'Completed Date', path: 'completedAt', type: 'date' },
      status: { label: 'Status', path: 'status', type: 'enum' },
      feedback: { label: 'Feedback', path: 'feedback', type: 'string' },
      rating: { label: 'Rating', path: 'rating', type: 'number' },
      notes: { label: 'Notes', path: 'notes', type: 'string' },
      createdAt: { label: 'Created Date', path: 'createdAt', type: 'date' },
    },
  },
  Project: {
    label: 'Projects',
    category: 'Projects',
    model: 'project',
    fields: {
      id: { label: 'Project ID', path: 'id', type: 'string' },
      name: { label: 'Project Name', path: 'name', type: 'string' },
      projectType: { label: 'Project Type', path: 'projectType', type: 'string' },
      description: { label: 'Description', path: 'description', type: 'string' },
      address: { label: 'Address', path: 'address', type: 'string' },
      city: { label: 'City', path: 'city', type: 'string' },
      state: { label: 'State', path: 'state', type: 'string' },
      totalUnits: { label: 'Total Units', path: 'totalUnits', type: 'number' },
      isActive: { label: 'Active', path: 'isActive', type: 'enum' },
      createdAt: { label: 'Created Date', path: 'createdAt', type: 'date' },
    },
  },
  Task: {
    label: 'Tasks',
    category: 'Tasks',
    model: 'task',
    fields: {
      id: { label: 'Task ID', path: 'id', type: 'string' },
      title: { label: 'Title', path: 'title', type: 'string' },
      description: { label: 'Description', path: 'description', type: 'string' },
      status: { label: 'Status', path: 'status', type: 'enum' },
      priority: { label: 'Priority', path: 'priority', type: 'enum' },
      dueDate: { label: 'Due Date', path: 'dueDate', type: 'date' },
      completedAt: { label: 'Completed Date', path: 'completedAt', type: 'date' },
      createdAt: { label: 'Created Date', path: 'createdAt', type: 'date' },
      ownerName: { label: 'Owner', path: 'owner.firstName', type: 'string', combine: ['owner.firstName', 'owner.lastName'] },
      leadName: { label: 'Lead', path: 'lead.lastName', type: 'string' },
      leadNumber: { label: 'Lead Number', path: 'lead.leadNumber', type: 'string' },
      projectName: { label: 'Project', path: 'project.name', type: 'string' },
    },
  },
  Booking: {
    label: 'Bookings',
    category: 'Bookings',
    model: 'booking',
    fields: {
      id: { label: 'Booking ID', path: 'id', type: 'string' },
      bookingNumber: { label: 'Booking Number', path: 'bookingNumber', type: 'string' },
      status: { label: 'Status', path: 'status', type: 'enum' },
      bookingStage: { label: 'Stage', path: 'bookingStage', type: 'enum' },
      bookingAmount: { label: 'Booking Amount', path: 'bookingAmount', type: 'number' },
      projectName: { label: 'Project', path: 'project.name', type: 'string' },
      unitNumber: { label: 'Unit', path: 'unit.number', type: 'string' },
      leadName: { label: 'Lead', path: 'lead.lastName', type: 'string' },
      leadNumber: { label: 'Lead Number', path: 'lead.leadNumber', type: 'string' },
      ownerName: { label: 'Owner', path: 'owner.firstName', type: 'string', combine: ['owner.firstName', 'owner.lastName'] },
      createdAt: { label: 'Created Date', path: 'createdAt', type: 'date' },
    },
  },
  CallDetail: {
    label: 'Call Details',
    category: 'Call Details',
    model: 'callDetail',
    fields: {
      id: { label: 'Call ID', path: 'id', type: 'string' },
      name: { label: 'Call Name', path: 'name', type: 'string' },
      callType: { label: 'Call Type', path: 'callType', type: 'string' },
      status: { label: 'Status', path: 'status', type: 'string' },
      callFrom: { label: 'Call From', path: 'callFrom', type: 'string' },
      callTo: { label: 'Call To', path: 'callTo', type: 'string' },
      duration: { label: 'Duration (seconds)', path: 'duration', type: 'number' },
      startAt: { label: 'Start', path: 'startAt', type: 'date' },
      endAt: { label: 'End', path: 'endAt', type: 'date' },
      notes: { label: 'Notes', path: 'notes', type: 'string' },
      leadName: { label: 'Lead', path: 'lead.lastName', type: 'string' },
      leadNumber: { label: 'Lead Number', path: 'lead.leadNumber', type: 'string' },
      ownerName: { label: 'Owner', path: 'owner.firstName', type: 'string', combine: ['owner.firstName', 'owner.lastName'] },
      createdAt: { label: 'Created Date', path: 'createdAt', type: 'date' },
    },
  },
  RRQueue: {
    label: 'Round Robin Queues',
    category: 'Round Robin',
    model: 'rRQueue',
    fields: {
      id: { label: 'Queue ID', path: 'id', type: 'string' },
      name: { label: 'Queue', path: 'name', type: 'string' },
      projectName: { label: 'Project', path: 'project.name', type: 'string' },
      leadCount: { label: 'Assigned Lead Count', path: 'leadCount', type: 'number' },
      noOfUsers: { label: 'Users', path: 'noOfUsers', type: 'number' },
      active: { label: 'Active', path: 'active', type: 'enum' },
      createdAt: { label: 'Created Date', path: 'createdAt', type: 'date' },
    },
  },
  RRQueueMember: {
    label: 'Round Robin Members',
    category: 'Round Robin',
    model: 'rRQueueMember',
    fields: {
      id: { label: 'Member ID', path: 'id', type: 'string' },
      userName: { label: 'User', path: 'user.firstName', type: 'string', combine: ['user.firstName', 'user.lastName'] },
      userEmail: { label: 'User Email', path: 'user.email', type: 'string' },
      queueName: { label: 'Round Robin Queue', path: 'rrQueue.name', type: 'string' },
      projectName: { label: 'Project', path: 'rrQueue.project.name', type: 'string' },
      userType: { label: 'User Type', path: 'userType', type: 'string' },
      currentLeadCount: { label: 'Leads Assigned', path: 'currentLeadCount', type: 'number' },
      maxLeadCapacity: { label: 'Max Lead Capacity', path: 'maxLeadCapacity', type: 'number' },
      sequenceId: { label: 'Sequence', path: 'sequenceId', type: 'number' },
      activeMember: { label: 'Active Member', path: 'activeMember', type: 'enum' },
      lastAssignedAt: { label: 'Last Assigned', path: 'lastAssignedAt', type: 'date' },
    },
  },
};