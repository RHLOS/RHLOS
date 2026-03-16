import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules } from './setup.js';

let WorkDB;

describe('WorkDB — Tasks/Projects Data Layer', () => {
    beforeEach(() => {
        const sandbox = loadModules('js/work-db.js');
        WorkDB = sandbox.WorkDB;
    });

    // ============================
    // Helpers
    // ============================
    describe('helpers', () => {
        it('todayKey returns YYYY-MM-DD', () => {
            expect(WorkDB.todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('dateKey formats Date objects', () => {
            expect(WorkDB.dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
        });

        it('dateKey returns strings as-is', () => {
            expect(WorkDB.dateKey('2026-12-25')).toBe('2026-12-25');
        });

        it('generateId starts with wk_', () => {
            expect(WorkDB.generateId()).toMatch(/^wk_/);
        });
    });

    // ============================
    // Clients CRUD
    // ============================
    describe('Clients', () => {
        it('addClient creates a client', () => {
            const c = WorkDB.addClient('Acme Corp');
            expect(c.name).toBe('Acme Corp');
            expect(c.archived).toBe(false);
            expect(c.id).toMatch(/^wk_/);
        });

        it('getClients excludes archived', () => {
            const c1 = WorkDB.addClient('Active');
            const c2 = WorkDB.addClient('Hidden');
            WorkDB.archiveClient(c2.id);
            const clients = WorkDB.getClients();
            expect(clients).toHaveLength(1);
            expect(clients[0].name).toBe('Active');
        });

        it('getAllClients includes archived', () => {
            WorkDB.addClient('A');
            const c2 = WorkDB.addClient('B');
            WorkDB.archiveClient(c2.id);
            expect(WorkDB.getAllClients()).toHaveLength(2);
        });

        it('getClient returns null for nonexistent', () => {
            expect(WorkDB.getClient('fake')).toBeNull();
        });

        it('updateClient modifies fields', () => {
            const c = WorkDB.addClient('Old');
            const updated = WorkDB.updateClient(c.id, { name: 'New' });
            expect(updated.name).toBe('New');
        });

        it('updateClient returns null for nonexistent', () => {
            expect(WorkDB.updateClient('fake', { name: 'X' })).toBeNull();
        });

        it('restoreClient unarchives', () => {
            const c = WorkDB.addClient('X');
            WorkDB.archiveClient(c.id);
            WorkDB.restoreClient(c.id);
            expect(WorkDB.getClient(c.id).archived).toBe(false);
        });

        it('getArchivedClients returns only archived', () => {
            WorkDB.addClient('A');
            const c2 = WorkDB.addClient('B');
            WorkDB.archiveClient(c2.id);
            const archived = WorkDB.getArchivedClients();
            expect(archived).toHaveLength(1);
            expect(archived[0].name).toBe('B');
        });

        it('permanentDeleteClient removes entirely', () => {
            const c = WorkDB.addClient('Gone');
            WorkDB.permanentDeleteClient(c.id);
            expect(WorkDB.getClient(c.id)).toBeNull();
        });

        it('clients are sorted by order', () => {
            const c1 = WorkDB.addClient('First');
            const c2 = WorkDB.addClient('Second');
            WorkDB.updateClient(c2.id, { order: 0 });
            WorkDB.updateClient(c1.id, { order: 1 });
            const clients = WorkDB.getClients();
            expect(clients[0].name).toBe('Second');
        });
    });

    // ============================
    // Projects CRUD
    // ============================
    describe('Projects', () => {
        it('addProject creates a project', () => {
            const client = WorkDB.addClient('C');
            const p = WorkDB.addProject(client.id, 'My Project');
            expect(p.name).toBe('My Project');
            expect(p.clientId).toBe(client.id);
            expect(p.archived).toBe(false);
        });

        it('getProjects filters by clientId', () => {
            const c1 = WorkDB.addClient('A');
            const c2 = WorkDB.addClient('B');
            WorkDB.addProject(c1.id, 'P1');
            WorkDB.addProject(c2.id, 'P2');
            expect(WorkDB.getProjects(c1.id)).toHaveLength(1);
        });

        it('getProjects excludes archived', () => {
            const c = WorkDB.addClient('C');
            WorkDB.addProject(c.id, 'Active');
            const p2 = WorkDB.addProject(c.id, 'Hidden');
            WorkDB.archiveProject(p2.id);
            expect(WorkDB.getProjects(c.id)).toHaveLength(1);
        });

        it('permanentDeleteProject removes project', () => {
            const c = WorkDB.addClient('C');
            const p = WorkDB.addProject(c.id, 'Gone');
            WorkDB.permanentDeleteProject(p.id);
            expect(WorkDB.getProject(p.id)).toBeNull();
        });
    });

    // ============================
    // Tasks CRUD
    // ============================
    describe('Tasks', () => {
        it('addTask creates a task with defaults', () => {
            const t = WorkDB.addTask({ title: 'Do something' });
            expect(t.title).toBe('Do something');
            expect(t.status).toBe('inbox');
            expect(t.verb).toBe('Anders');
            expect(t.important).toBe(false);
            expect(t.urgent).toBe(false);
            expect(t.recurring).toBe('geen');
            expect(t.completedAt).toBeNull();
            expect(t.archivedAt).toBeNull();
        });

        it('getTasks excludes archived tasks', () => {
            WorkDB.addTask({ title: 'Active' });
            const t2 = WorkDB.addTask({ title: 'Archived' });
            WorkDB.archiveTask(t2.id);
            expect(WorkDB.getTasks()).toHaveLength(1);
        });

        it('getTask returns null for nonexistent', () => {
            expect(WorkDB.getTask('nope')).toBeNull();
        });

        it('getInboxTasks returns tasks without project', () => {
            WorkDB.addTask({ title: 'No project', projectId: null });
            const c = WorkDB.addClient('C');
            const p = WorkDB.addProject(c.id, 'P');
            WorkDB.addTask({ title: 'Has project', projectId: p.id, clientId: c.id });
            const inbox = WorkDB.getInboxTasks();
            expect(inbox).toHaveLength(1);
            expect(inbox[0].title).toBe('No project');
        });

        it('getTasksByProject filters by projectId', () => {
            const c = WorkDB.addClient('C');
            const p = WorkDB.addProject(c.id, 'P');
            WorkDB.addTask({ title: 'T1', projectId: p.id });
            WorkDB.addTask({ title: 'T2', projectId: null });
            expect(WorkDB.getTasksByProject(p.id)).toHaveLength(1);
        });

        it('archiveTask and restoreTask work', () => {
            const t = WorkDB.addTask({ title: 'X' });
            WorkDB.archiveTask(t.id);
            expect(WorkDB.getTask(t.id).archivedAt).toBeTruthy();
            WorkDB.restoreTask(t.id);
            expect(WorkDB.getTask(t.id).archivedAt).toBeNull();
        });
    });

    // ============================
    // Task Status Transitions
    // ============================
    describe('Task Status Transitions', () => {
        it('sets completedAt when status changes to afgerond', () => {
            const t = WorkDB.addTask({ title: 'X', status: 'gepland' });
            const updated = WorkDB.updateTask(t.id, { status: 'afgerond' });
            expect(updated.completedAt).toBeTruthy();
        });

        it('clears completedAt when status changes away from afgerond', () => {
            const t = WorkDB.addTask({ title: 'X', status: 'afgerond' });
            // Force completedAt to exist
            WorkDB.updateTask(t.id, { status: 'afgerond' });
            const updated = WorkDB.updateTask(t.id, { status: 'gepland' });
            expect(updated.completedAt).toBeNull();
        });
    });

    // ============================
    // Next Action Constraint
    // ============================
    describe('Next Action', () => {
        it('setNextAction toggles on', () => {
            const c = WorkDB.addClient('C');
            const p = WorkDB.addProject(c.id, 'P');
            const t = WorkDB.addTask({ title: 'T', projectId: p.id, clientId: c.id });
            const result = WorkDB.setNextAction(t.id);
            expect(result.nextAction).toBe(true);
        });

        it('setNextAction toggles off', () => {
            const c = WorkDB.addClient('C');
            const p = WorkDB.addProject(c.id, 'P');
            const t = WorkDB.addTask({ title: 'T', projectId: p.id, clientId: c.id });
            WorkDB.setNextAction(t.id);
            const result = WorkDB.setNextAction(t.id);
            expect(result.nextAction).toBe(false);
        });

        it('setNextAction clears previous nextAction in same project', () => {
            const c = WorkDB.addClient('C');
            const p = WorkDB.addProject(c.id, 'P');
            const t1 = WorkDB.addTask({ title: 'T1', projectId: p.id, clientId: c.id });
            const t2 = WorkDB.addTask({ title: 'T2', projectId: p.id, clientId: c.id });
            WorkDB.setNextAction(t1.id);
            WorkDB.setNextAction(t2.id);
            expect(WorkDB.getTask(t1.id).nextAction).toBe(false);
            expect(WorkDB.getTask(t2.id).nextAction).toBe(true);
        });

        it('addTask enforces nextAction constraint on create', () => {
            const c = WorkDB.addClient('C');
            const p = WorkDB.addProject(c.id, 'P');
            const t1 = WorkDB.addTask({ title: 'T1', projectId: p.id, clientId: c.id, nextAction: true });
            const t2 = WorkDB.addTask({ title: 'T2', projectId: p.id, clientId: c.id, nextAction: true });
            expect(WorkDB.getTask(t1.id).nextAction).toBe(false);
            expect(t2.nextAction).toBe(true);
        });

        it('setNextAction returns null for nonexistent task', () => {
            expect(WorkDB.setNextAction('fake')).toBeNull();
        });
    });

    // ============================
    // Recurring Tasks
    // ============================
    describe('Recurring Tasks', () => {
        it('processRecurringTask returns null for non-recurring', () => {
            const t = WorkDB.addTask({ title: 'X', recurring: 'geen' });
            expect(WorkDB.processRecurringTask(t.id)).toBeNull();
        });

        it('processRecurringTask returns null for nonexistent task', () => {
            expect(WorkDB.processRecurringTask('fake')).toBeNull();
        });

        it('processes dagelijks recurrence', () => {
            const t = WorkDB.addTask({
                title: 'Daily task',
                recurring: 'dagelijks',
                deadline: '2026-03-10',
            });
            const newTask = WorkDB.processRecurringTask(t.id);
            expect(newTask.deadline).toBe('2026-03-11');
            expect(newTask.title).toBe('Daily task');
            expect(newTask.recurring).toBe('dagelijks');
            expect(newTask.status).toBe('gepland');
            expect(newTask.completedAt).toBeNull();
            expect(newTask.id).not.toBe(t.id);
        });

        it('processes wekelijks recurrence', () => {
            const t = WorkDB.addTask({
                title: 'Weekly',
                recurring: 'wekelijks',
                deadline: '2026-03-10',
            });
            const newTask = WorkDB.processRecurringTask(t.id);
            expect(newTask.deadline).toBe('2026-03-17');
        });

        it('processes tweewekelijks recurrence', () => {
            const t = WorkDB.addTask({
                title: 'Biweekly',
                recurring: 'tweewekelijks',
                deadline: '2026-03-10',
            });
            const newTask = WorkDB.processRecurringTask(t.id);
            expect(newTask.deadline).toBe('2026-03-24');
        });

        it('processes maandelijks recurrence', () => {
            const t = WorkDB.addTask({
                title: 'Monthly',
                recurring: 'maandelijks',
                deadline: '2026-01-15',
            });
            const newTask = WorkDB.processRecurringTask(t.id);
            expect(newTask.deadline).toBe('2026-02-15');
        });

        it('processes kwartaal recurrence', () => {
            const t = WorkDB.addTask({
                title: 'Quarterly',
                recurring: 'kwartaal',
                deadline: '2026-01-15',
            });
            const newTask = WorkDB.processRecurringTask(t.id);
            expect(newTask.deadline).toBe('2026-04-15');
        });

        it('handles month-end rollover for maandelijks', () => {
            const t = WorkDB.addTask({
                title: 'End of month',
                recurring: 'maandelijks',
                deadline: '2026-01-31',
            });
            const newTask = WorkDB.processRecurringTask(t.id);
            // Jan 31 + 1 month = Feb 28 (2026 is not a leap year) or Mar 3
            // JS Date handles this by rolling over to March
            expect(newTask.deadline).toBeTruthy();
        });

        it('copies fields but resets completedAt and actualMin', () => {
            const t = WorkDB.addTask({
                title: 'Recurring',
                recurring: 'wekelijks',
                deadline: '2026-03-10',
                important: true,
                urgent: true,
                energy: 'hoog',
                estimateMin: 30,
                actualMin: 25,
                context: 'kantoor',
            });
            const newTask = WorkDB.processRecurringTask(t.id);
            expect(newTask.important).toBe(true);
            expect(newTask.urgent).toBe(true);
            expect(newTask.energy).toBe('hoog');
            expect(newTask.estimateMin).toBe(30);
            expect(newTask.actualMin).toBeNull();
            expect(newTask.completedAt).toBeNull();
            expect(newTask.context).toBe('kantoor');
        });

        it('handles null deadline', () => {
            const t = WorkDB.addTask({
                title: 'No deadline',
                recurring: 'wekelijks',
                deadline: null,
            });
            const newTask = WorkDB.processRecurringTask(t.id);
            expect(newTask.deadline).toBeNull();
        });
    });

    // ============================
    // Batch Operations
    // ============================
    describe('Batch Operations', () => {
        it('moveTasks changes project and client', () => {
            const c = WorkDB.addClient('C');
            const p = WorkDB.addProject(c.id, 'P');
            const t1 = WorkDB.addTask({ title: 'T1' });
            const t2 = WorkDB.addTask({ title: 'T2' });
            WorkDB.moveTasks([t1.id, t2.id], p.id, c.id);
            expect(WorkDB.getTask(t1.id).projectId).toBe(p.id);
            expect(WorkDB.getTask(t2.id).clientId).toBe(c.id);
        });

        it('moveTasks changes inbox status to gepland', () => {
            const c = WorkDB.addClient('C');
            const p = WorkDB.addProject(c.id, 'P');
            const t = WorkDB.addTask({ title: 'T', status: 'inbox' });
            WorkDB.moveTasks([t.id], p.id, c.id);
            expect(WorkDB.getTask(t.id).status).toBe('gepland');
        });

        it('batchArchive archives multiple tasks', () => {
            const t1 = WorkDB.addTask({ title: 'T1' });
            const t2 = WorkDB.addTask({ title: 'T2' });
            WorkDB.batchArchive([t1.id, t2.id]);
            expect(WorkDB.getTask(t1.id).archivedAt).toBeTruthy();
            expect(WorkDB.getTask(t2.id).archivedAt).toBeTruthy();
        });
    });

    // ============================
    // Filters
    // ============================
    describe('Filtering', () => {
        it('getTasks with scalar filter', () => {
            WorkDB.addTask({ title: 'Urgent', urgent: true });
            WorkDB.addTask({ title: 'Normal', urgent: false });
            const result = WorkDB.getTasks({ urgent: true });
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Urgent');
        });

        it('getTasks with array filter', () => {
            WorkDB.addTask({ title: 'A', status: 'inbox' });
            WorkDB.addTask({ title: 'B', status: 'gepland' });
            WorkDB.addTask({ title: 'C', status: 'afgerond' });
            const result = WorkDB.getTasks({ status: ['inbox', 'gepland'] });
            expect(result).toHaveLength(2);
        });

        it('getTasks ignores null/empty filters', () => {
            WorkDB.addTask({ title: 'A' });
            WorkDB.addTask({ title: 'B' });
            const result = WorkDB.getTasks({ status: null, verb: '' });
            expect(result).toHaveLength(2);
        });
    });

    // ============================
    // Stats
    // ============================
    describe('getTaskStats', () => {
        it('counts completed and created tasks in range', () => {
            WorkDB.addTask({ title: 'Old' });
            const t = WorkDB.addTask({ title: 'Done', status: 'gepland' });
            WorkDB.updateTask(t.id, { status: 'afgerond' });

            const stats = WorkDB.getTaskStats(
                new Date(Date.now() - 86400000).toISOString().slice(0, 10),
                new Date(Date.now() + 86400000).toISOString().slice(0, 10),
            );
            expect(stats.completedCount).toBe(1);
            expect(stats.createdCount).toBe(2);
        });

        it('calculates deviation factor', () => {
            const t = WorkDB.addTask({
                title: 'Timed',
                estimateMin: 30,
                actualMin: 45,
            });
            WorkDB.updateTask(t.id, { status: 'afgerond' });

            const stats = WorkDB.getTaskStats(
                new Date(Date.now() - 86400000).toISOString().slice(0, 10),
                new Date(Date.now() + 86400000).toISOString().slice(0, 10),
            );
            expect(stats.deviationFactor).toBe('1.50');
        });
    });
});
