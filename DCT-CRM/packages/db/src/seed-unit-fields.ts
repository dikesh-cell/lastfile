import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type UnitFieldRow = [string, string, string, boolean, string];

const rows = JSON.parse(
  readFileSync(join(__dirname, 'salesforce-unit-fields.json'), 'utf8'),
) as UnitFieldRow[];

const sectionOrder = [
  'Unit Information',
  'Related Records',
  'Area and Plot',
  'Boundaries',
  'Pricing',
  'Charges',
  'Tax',
  'Totals',
  'Comments',
];

const readOnlyNames = new Set(['CreatedById', 'LastModifiedById', 'Project__c']);

type PicklistOption = { value: string; isActive?: boolean; isDefault?: boolean };

const unitPicklists: Record<string, PicklistOption[]> = {
  Status1__c: ['Active', 'Swapped', 'Cancelled', 'Completed'].map((value) => ({ value })),
  BHK_Type__c: [
    '1BHK', '2BHK', '3BHK', '4BHK', '5BHK', '3 BHK (2T)', '3 BHK + 3T', '3 BHK + 2T',
    '2.5 BHK', '2 BHK + 2T', '2 BHK (2 T)', '3 BHK (2 T)', '3 BHK (3 T)',
  ].map((value) => ({ value })),
  Measurment_Type__c: ['Sqft', 'Sqmt', 'Cent', 'Acre'].map((value) => ({ value })),
  Category__c: ['Standard', 'Premium'].map((value) => ({ value })),
  Phase_Detail__c: ['Phase-1', 'Phase-2', 'Phase-3', 'Phase-4', 'Phase-5', 'Bulk'].map((value) => ({ value })),
  Plot_Type__c: [
    { value: 'Land', isDefault: true },
    { value: 'Apartments', isActive: false },
    { value: 'Flat', isActive: false },
    { value: 'Villa', isActive: false },
  ],
  Floor__c: Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1) })),
  Property_Type__c: ['Villa', 'Apartment'].map((value) => ({ value })),
  Sold_Details__c: ['NR', 'Registered', 'Unsold'].map((value) => ({ value })),
  Tower__c: 'ABCDEFGHIJKLMNOPQRST'.split('').map((value) => ({ value })),
  Unit_Facing_Direction__c: [
    'North', 'South', 'East', 'West', 'North East', 'South East', 'North West', 'South West',
  ].map((value) => ({ value })).concat([
    { value: 'NORTH WEST', isActive: false },
    { value: 'NORTH EAST', isActive: false },
  ]),
};

function describeField(sourceType: string) {
  const formula = /^Formula \((.+)\)$/.exec(sourceType);
  const type = formula?.[1] || sourceType;
  const sized = /^(Currency|Number|Percent|Text|Text Area|Long Text Area)\((\d+)(?:,\s*(\d+))?\)$/.exec(type);
  const lookup = /^(?:Lookup|Master-Detail)\((.+)\)$/.exec(sourceType);
  const precision = sized && ['Currency', 'Number', 'Percent'].includes(sized[1]) ? Number(sized[2]) : undefined;
  const scale = sized?.[3] ? Number(sized[3]) : undefined;
  const maxLength = sized && !precision ? Number(sized[2]) : undefined;
  const fieldType = formula
    ? type === 'Checkbox' ? 'boolean'
      : type === 'Number' || type === 'Currency' ? 'number'
        : 'text'
    : type === 'Checkbox' ? 'boolean'
      : type === 'Date' ? 'date'
        : type === 'Picklist' ? 'picklist'
          : type.startsWith('Currency') ? 'currency'
            : type.startsWith('Percent') ? 'percentage'
              : type.startsWith('Number') ? 'number'
                : type.startsWith('Long Text Area') || type.startsWith('Text Area') ? 'longText'
                  : lookup ? 'lookup'
                    : 'text';
  const formulaHelp = formula
    ? ' Formula field. The Salesforce formula was not included, so this value is not calculated.'
    : '';
  const picklistHelp = type === 'Picklist'
    ? ' Picklist choices were not included with the field list.'
    : '';
  return {
    fieldType: formula && type === 'Currency' ? 'currency' : fieldType,
    precision,
    scale,
    maxLength,
    lookupObject: lookup?.[1],
    readOnly: Boolean(formula),
    helpText: `Salesforce type: ${sourceType}.${formulaHelp}${picklistHelp}`,
  };
}

async function main() {
  const names = rows.map((row) => row[1]);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length) throw new Error(`Duplicate Unit field names: ${duplicates.join(', ')}`);

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  for (const tenant of tenants) {
    const admin = await prisma.user.findFirst({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!admin) {
      console.warn(`Skipping ${tenant.name}: no active user`);
      continue;
    }

    const existing = await prisma.objectDefinition.findFirst({
      where: { tenantId: tenant.id, name: 'Unit' },
      select: { id: true },
    });
    const object = existing ?? await prisma.objectDefinition.create({
      data: {
        tenantId: tenant.id,
        name: 'Unit',
        label: 'Unit',
        pluralLabel: 'Units',
        icon: 'building',
        description: 'Manage project units',
        objectType: 'standard',
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      select: { id: true },
    });

    for (const [index, [label, name, sourceType, required]] of rows.entries()) {
      const described = describeField(sourceType);
      const readOnly = described.readOnly || readOnlyNames.has(name);
      const data = {
        label,
        fieldType: described.fieldType,
        description: sourceType,
        helpText: unitPicklists[name] ? `Salesforce type: ${sourceType}.` : described.helpText,
        required,
        maxLength: described.maxLength,
        precision: described.precision,
        scale: described.scale,
        lookupObject: described.lookupObject,
        visible: true,
        editable: !readOnly,
        isActive: true,
        isSystemField: false,
        isCustomField: name.endsWith('__c'),
        isStandardField: !name.endsWith('__c'),
        searchable: true,
        sortable: !described.readOnly,
        filterable: described.fieldType === 'picklist' || described.fieldType === 'boolean' || described.fieldType === 'date',
        displayOrder: index,
        updatedBy: admin.id,
      };
      const field = await prisma.fieldDefinition.upsert({
        where: { objectId_name: { objectId: object.id, name } },
        create: { tenantId: tenant.id, objectId: object.id, name, createdBy: admin.id, ...data },
        update: data,
        select: { id: true },
      });
      const options = unitPicklists[name];
      if (!options) continue;
      await prisma.picklistValue.updateMany({
        where: { fieldId: field.id, value: { notIn: options.map((option) => option.value) } },
        data: { isActive: false },
      });
      for (const [optionIndex, option] of options.entries()) {
        const picklist = {
          label: option.value,
          isActive: option.isActive !== false,
          isDefault: option.isDefault === true,
          displayOrder: optionIndex,
        };
        await prisma.picklistValue.upsert({
          where: { fieldId_value: { fieldId: field.id, value: option.value } },
          create: { tenantId: tenant.id, fieldId: field.id, value: option.value, ...picklist },
          update: picklist,
        });
      }
    }

    const sections = sectionOrder.map((section) => ({
      name: section,
      fields: rows.filter((row) => row[4] === section).map((row) => row[1]),
    })).filter((section) => section.fields.length > 0);

    const layout = await prisma.pageLayout.findFirst({
      where: { objectId: object.id, name: 'Default Layout' },
      select: { id: true },
    });
    if (layout) {
      await prisma.pageLayout.update({
        where: { id: layout.id },
        data: { sections, isDefault: true, updatedBy: admin.id },
      });
    } else {
      await prisma.pageLayout.create({
        data: {
          tenantId: tenant.id,
          objectId: object.id,
          name: 'Default Layout',
          isDefault: true,
          sections,
          createdBy: admin.id,
        },
      });
    }

    console.log(`${tenant.name}: Unit has ${rows.length} fields`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
