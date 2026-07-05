/* eslint-disable no-console */
import { faker } from '@faker-js/faker';
import {
  PrismaClient,
  SeniorityLevel,
  EmailVerificationStatus,
  ListType,
  SequenceStepType,
  EnrollmentStatus,
  StepExecutionStatus,
  EmailMessageStatus,
  EmailEventType,
  TaskType,
  TaskStatus,
  ActivityType,
  MailboxProvider,
} from '@prisma/client';
import { companySizeFromCount } from '../src/company-size';

const prisma = new PrismaClient();

const COMPANY_COUNT = Number(process.env.SEED_COMPANY_COUNT ?? 10_000);
const CONTACT_COUNT = Number(process.env.SEED_CONTACT_COUNT ?? 50_000);
const BATCH_SIZE = 1_000;

const INDUSTRIES = [
  'Software',
  'Financial Services',
  'Healthcare',
  'E-commerce',
  'Manufacturing',
  'Education',
  'Real Estate',
  'Telecommunications',
  'Logistics',
  'Media & Entertainment',
  'Energy',
  'Hospitality',
  'Legal Services',
  'Nonprofit',
  'Cybersecurity',
];

const TECH_STACK_POOL = [
  'Salesforce',
  'HubSpot',
  'AWS',
  'GCP',
  'Azure',
  'Kubernetes',
  'React',
  'Node.js',
  'Postgres',
  'Snowflake',
  'Segment',
  'Zendesk',
  'Slack',
  'Stripe',
  'Workday',
];

const TITLES: Array<{ title: string; seniority: SeniorityLevel; department: string }> = [
  { title: 'Chief Executive Officer', seniority: SeniorityLevel.C_SUITE, department: 'Executive' },
  { title: 'Chief Revenue Officer', seniority: SeniorityLevel.C_SUITE, department: 'Sales' },
  { title: 'VP of Sales', seniority: SeniorityLevel.VP, department: 'Sales' },
  { title: 'VP of Marketing', seniority: SeniorityLevel.VP, department: 'Marketing' },
  { title: 'Director of Sales', seniority: SeniorityLevel.DIRECTOR, department: 'Sales' },
  { title: 'Director of Engineering', seniority: SeniorityLevel.DIRECTOR, department: 'Engineering' },
  { title: 'Sales Manager', seniority: SeniorityLevel.MANAGER, department: 'Sales' },
  { title: 'Account Executive', seniority: SeniorityLevel.SENIOR, department: 'Sales' },
  { title: 'Sales Development Representative', seniority: SeniorityLevel.ENTRY, department: 'Sales' },
  { title: 'Marketing Manager', seniority: SeniorityLevel.MANAGER, department: 'Marketing' },
  { title: 'Software Engineer', seniority: SeniorityLevel.SENIOR, department: 'Engineering' },
  { title: 'Founder', seniority: SeniorityLevel.FOUNDER, department: 'Executive' },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

async function chunkedCreateMany<T>(
  items: T[],
  fn: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    await fn(items.slice(i, i + BATCH_SIZE));
    process.stdout.write(`\r  seeded ${Math.min(i + BATCH_SIZE, items.length)}/${items.length}`);
  }
  process.stdout.write('\n');
}

async function main(): Promise<void> {
  console.log('Seeding Prospect demo data...');

  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Prospect Demo Org',
      slug: 'demo',
      domain: 'prospect-demo.com',
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@prospect-demo.com' },
    update: {},
    create: { email: 'owner@prospect-demo.com', name: 'Dana Owner' },
  });
  const rep = await prisma.user.upsert({
    where: { email: 'rep@prospect-demo.com' },
    update: {},
    create: { email: 'rep@prospect-demo.com', name: 'Ravi Rep' },
  });

  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: owner.id } },
    update: {},
    create: { organizationId: org.id, userId: owner.id, role: 'OWNER' },
  });
  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: rep.id } },
    update: {},
    create: { organizationId: org.id, userId: rep.id, role: 'REP' },
  });

  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: { organizationId: org.id, plan: 'growth', seats: 5, status: 'ACTIVE' },
  });

  const stageDefs = [
    { name: 'New', order: 1, probability: 10 },
    { name: 'Qualified', order: 2, probability: 25 },
    { name: 'Meeting Booked', order: 3, probability: 45 },
    { name: 'Proposal', order: 4, probability: 65 },
    { name: 'Negotiation', order: 5, probability: 85 },
    { name: 'Closed Won', order: 6, probability: 100 },
    { name: 'Closed Lost', order: 7, probability: 0 },
  ];
  const stages = [];
  for (const s of stageDefs) {
    stages.push(
      await prisma.pipelineStage.upsert({
        where: { organizationId_order: { organizationId: org.id, order: s.order } },
        update: {},
        create: {
          organizationId: org.id,
          name: s.name,
          order: s.order,
          probability: s.probability,
          isWon: s.name === 'Closed Won',
          isLost: s.name === 'Closed Lost',
        },
      }),
    );
  }

  console.log(`Generating ${COMPANY_COUNT} companies...`);
  const companyRows = Array.from({ length: COMPANY_COUNT }).map(() => {
    const employeeCount = faker.number.int({ min: 1, max: 50_000 });
    return {
      organizationId: org.id,
      name: faker.company.name(),
      domain: faker.internet.domainName(),
      industry: pick(INDUSTRIES),
      employeeCount,
      companySize: companySizeFromCount(employeeCount),
      annualRevenue: BigInt(faker.number.int({ min: 100_000, max: 500_000_000 })),
      foundedYear: faker.number.int({ min: 1970, max: 2024 }),
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      country: faker.location.country(),
      linkedinUrl: `https://linkedin.com/company/${faker.helpers.slugify(faker.company.name()).toLowerCase()}`,
      techStack: faker.helpers.arrayElements(TECH_STACK_POOL, { min: 1, max: 6 }),
      fundingStage: pick(['Seed', 'Series A', 'Series B', 'Series C', 'Public', 'Bootstrapped']),
      totalFundingUsd: BigInt(faker.number.int({ min: 0, max: 200_000_000 })),
      description: faker.company.catchPhrase(),
    };
  });
  await chunkedCreateMany(companyRows, (batch) =>
    prisma.company.createMany({ data: batch, skipDuplicates: true }),
  );

  const companyIds = (
    await prisma.company.findMany({ where: { organizationId: org.id }, select: { id: true } })
  ).map((c) => c.id);

  console.log(`Generating ${CONTACT_COUNT} contacts...`);
  const contactRows = Array.from({ length: CONTACT_COUNT }).map(() => {
    const t = pick(TITLES);
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
      organizationId: org.id,
      companyId: pick(companyIds),
      firstName,
      lastName,
      title: t.title,
      seniority: t.seniority,
      department: t.department,
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      emailStatus: pick([
        EmailVerificationStatus.VALID,
        EmailVerificationStatus.VALID,
        EmailVerificationStatus.VALID,
        EmailVerificationStatus.RISKY,
        EmailVerificationStatus.INVALID,
        EmailVerificationStatus.UNVERIFIED,
      ]),
      emailScore: faker.number.float({ min: 0, max: 1, fractionDigits: 2 }),
      phone: faker.phone.number(),
      linkedinUrl: `https://linkedin.com/in/${faker.helpers.slugify(`${firstName}-${lastName}`).toLowerCase()}`,
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      country: faker.location.country(),
    };
  });
  await chunkedCreateMany(contactRows, (batch) =>
    prisma.contact.createMany({ data: batch, skipDuplicates: true }),
  );

  const sampleContacts = await prisma.contact.findMany({
    where: { organizationId: org.id },
    take: 500,
    select: { id: true, companyId: true },
  });

  // Tags
  const tagNames = ['Hot Lead', 'Enterprise', 'SMB', 'Champion', 'Do Not Contact'];
  const tags = [];
  for (const name of tagNames) {
    tags.push(
      await prisma.tag.upsert({
        where: { organizationId_name: { organizationId: org.id, name } },
        update: {},
        create: { organizationId: org.id, name, color: faker.color.rgb() },
      }),
    );
  }
  for (const c of sampleContacts.slice(0, 100)) {
    await prisma.contactTag.createMany({
      data: [{ contactId: c.id, tagId: pick(tags).id }],
      skipDuplicates: true,
    });
  }

  // Lists + saved searches
  const contactList = await prisma.list.create({
    data: { organizationId: org.id, name: 'Q3 Outbound Targets', type: ListType.CONTACT },
  });
  await prisma.listMembership.createMany({
    data: sampleContacts.slice(0, 200).map((c) => ({ listId: contactList.id, contactId: c.id })),
    skipDuplicates: true,
  });
  await prisma.savedSearch.create({
    data: {
      organizationId: org.id,
      name: 'VPs of Sales at Series B+ companies',
      entity: ListType.CONTACT,
      filters: { seniority: ['VP', 'C_SUITE'], fundingStage: ['Series B', 'Series C'] },
    },
  });

  // Mailboxes
  const mailbox = await prisma.mailbox.create({
    data: {
      organizationId: org.id,
      userId: rep.id,
      email: 'ravi@prospect-demo.com',
      provider: MailboxProvider.GMAIL_OAUTH,
      dailySendLimit: 100,
      warmupEnabled: true,
      spfConfigured: true,
      dkimConfigured: true,
      dmarcConfigured: false,
    },
  });

  // Sequence
  const sequence = await prisma.sequence.create({
    data: {
      organizationId: org.id,
      name: 'Outbound - VP Sales Series B',
      status: 'ACTIVE',
      steps: {
        create: [
          {
            order: 1,
            type: SequenceStepType.EMAIL,
            waitDays: 0,
            subject: 'Quick question about {{company.name}}',
            bodyHtml: '<p>Hi {{contact.firstName}}, quick question...</p>',
            variantKey: 'A',
          },
          {
            order: 1,
            type: SequenceStepType.EMAIL,
            waitDays: 0,
            subject: 'Idea for {{company.name}}',
            bodyHtml: '<p>Hi {{contact.firstName}}, had an idea...</p>',
            variantKey: 'B',
          },
          {
            order: 2,
            type: SequenceStepType.CALL,
            waitDays: 2,
          },
          {
            order: 3,
            type: SequenceStepType.LINKEDIN_TASK,
            waitDays: 2,
          },
          {
            order: 4,
            type: SequenceStepType.EMAIL,
            waitDays: 3,
            subject: 'Following up',
            bodyHtml: '<p>Bumping this to the top of your inbox.</p>',
            variantKey: 'A',
          },
        ],
      },
    },
    include: { steps: true },
  });

  const stepA1 = sequence.steps.find((s) => s.order === 1 && s.variantKey === 'A')!;

  for (const c of sampleContacts.slice(0, 150)) {
    const enrollment = await prisma.sequenceEnrollment.create({
      data: {
        sequenceId: sequence.id,
        contactId: c.id,
        ownerId: rep.id,
        status: EnrollmentStatus.ACTIVE,
        currentStepOrder: 2,
      },
    });

    const emailMessage = await prisma.emailMessage.create({
      data: {
        organizationId: org.id,
        mailboxId: mailbox.id,
        contactId: c.id,
        subject: stepA1.subject ?? 'Quick question',
        bodyHtml: stepA1.bodyHtml ?? '<p></p>',
        status: EmailMessageStatus.DELIVERED,
        sentAt: faker.date.recent({ days: 5 }),
      },
    });

    await prisma.sequenceStepExecution.create({
      data: {
        enrollmentId: enrollment.id,
        stepId: stepA1.id,
        status: StepExecutionStatus.SENT,
        scheduledFor: faker.date.recent({ days: 5 }),
        executedAt: faker.date.recent({ days: 5 }),
        emailMessageId: emailMessage.id,
      },
    });

    if (Math.random() < 0.4) {
      await prisma.emailEvent.create({
        data: { emailMessageId: emailMessage.id, type: EmailEventType.OPEN },
      });
    }
    if (Math.random() < 0.1) {
      await prisma.emailEvent.create({
        data: { emailMessageId: emailMessage.id, type: EmailEventType.CLICK },
      });
    }

    await prisma.activity.create({
      data: {
        organizationId: org.id,
        actorUserId: rep.id,
        contactId: c.id,
        companyId: c.companyId,
        type: ActivityType.EMAIL_SENT,
        metadata: { emailMessageId: emailMessage.id },
      },
    });
  }

  // Deals
  for (const c of sampleContacts.slice(0, 80)) {
    const stage = pick(stages);
    await prisma.deal.create({
      data: {
        organizationId: org.id,
        name: `${faker.company.buzzPhrase()} deal`,
        companyId: c.companyId,
        contactId: c.id,
        stageId: stage.id,
        amountUsd: faker.number.int({ min: 5_000, max: 250_000 }),
        closeDate: faker.date.soon({ days: 60 }),
      },
    });
  }

  // Tasks & notes
  for (const c of sampleContacts.slice(0, 60)) {
    await prisma.task.create({
      data: {
        organizationId: org.id,
        ownerId: rep.id,
        contactId: c.id,
        type: pick([TaskType.CALL, TaskType.EMAIL, TaskType.LINKEDIN, TaskType.GENERAL]),
        status: pick([TaskStatus.OPEN, TaskStatus.COMPLETED]),
        title: 'Follow up with contact',
        dueAt: faker.date.soon({ days: 7 }),
      },
    });
    await prisma.note.create({
      data: {
        organizationId: org.id,
        authorId: rep.id,
        contactId: c.id,
        body: faker.lorem.sentences(2),
      },
    });
  }

  // Daily metrics for last 30 days
  const dailyMetricRows = Array.from({ length: 30 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    return {
      organizationId: org.id,
      date,
      emailsSent: faker.number.int({ min: 20, max: 200 }),
      emailsOpened: faker.number.int({ min: 5, max: 100 }),
      emailsClicked: faker.number.int({ min: 0, max: 30 }),
      emailsReplied: faker.number.int({ min: 0, max: 15 }),
      emailsBounced: faker.number.int({ min: 0, max: 5 }),
      dealsCreated: faker.number.int({ min: 0, max: 5 }),
      dealsWon: faker.number.int({ min: 0, max: 2 }),
      dealsWonUsd: faker.number.int({ min: 0, max: 50_000 }),
    };
  });
  await prisma.dailyMetric.createMany({ data: dailyMetricRows, skipDuplicates: true });

  // API key + webhook (demo, not usable secrets)
  await prisma.apiKey.create({
    data: {
      organizationId: org.id,
      name: 'Demo API Key',
      keyPrefix: 'psk_demo',
      keyHash: 'demo-hash-not-a-real-secret',
      scopes: ['leads:read', 'sequences:write'],
    },
  });
  await prisma.webhookEndpoint.create({
    data: {
      organizationId: org.id,
      url: 'https://example.com/webhooks/prospect',
      secret: 'demo-webhook-secret',
      events: ['contact.created', 'deal.stage_changed', 'email.replied'],
    },
  });

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
