// ============================================================
// work-db.js — Data layer for Tasks/Projects in RHLOS
// ============================================================

const WorkDB = (() => {

    const CLIENTS_KEY = 'wk_clients';
    const PROJECTS_KEY = 'wk_projects';
    const TASKS_KEY = 'wk_tasks';

    // --- Storage helpers ---

    function _get(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error('WorkDB._get error:', e);
            return null;
        }
    }

    function _set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('WorkDB._set error:', e);
        }
    }

    function generateId() {
        return 'wk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function todayKey() {
        return dateKey(new Date());
    }

    function dateKey(date) {
        if (typeof date === 'string') return date;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // --- Clients CRUD ---

    function _getClientsRaw() {
        return _get(CLIENTS_KEY) || [];
    }

    function getClients() {
        return _getClientsRaw()
            .filter(c => !c.archived)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    function getAllClients() {
        return _getClientsRaw();
    }

    function getClient(id) {
        return _getClientsRaw().find(c => c.id === id) || null;
    }

    function addClient(name) {
        const clients = _getClientsRaw();
        const client = {
            id: generateId(),
            name: name.trim(),
            archived: false,
            createdAt: new Date().toISOString(),
            order: clients.length
        };
        clients.push(client);
        _set(CLIENTS_KEY, clients);
        return client;
    }

    function updateClient(id, updates) {
        const clients = _getClientsRaw();
        const idx = clients.findIndex(c => c.id === id);
        if (idx === -1) return null;
        Object.assign(clients[idx], updates);
        _set(CLIENTS_KEY, clients);
        return clients[idx];
    }

    function archiveClient(id) {
        return updateClient(id, { archived: true, archivedAt: new Date().toISOString() });
    }

    function restoreClient(id) {
        return updateClient(id, { archived: false, archivedAt: null });
    }

    function getArchivedClients() {
        return _getClientsRaw().filter(c => c.archived);
    }

    function permanentDeleteClient(id) {
        const clients = _getClientsRaw().filter(c => c.id !== id);
        _set(CLIENTS_KEY, clients);
    }

    // --- Projects CRUD ---

    function _getProjectsRaw() {
        return _get(PROJECTS_KEY) || [];
    }

    function getProjects(clientId) {
        let projects = _getProjectsRaw().filter(p => !p.archived);
        if (clientId) projects = projects.filter(p => p.clientId === clientId);
        return projects.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    function getAllProjects() {
        return _getProjectsRaw();
    }

    function getProject(id) {
        return _getProjectsRaw().find(p => p.id === id) || null;
    }

    function getProjectsByClient(clientId) {
        return getProjects(clientId);
    }

    function addProject(clientId, name) {
        const projects = _getProjectsRaw();
        const project = {
            id: generateId(),
            clientId: clientId,
            name: name.trim(),
            archived: false,
            createdAt: new Date().toISOString(),
            order: projects.filter(p => p.clientId === clientId).length
        };
        projects.push(project);
        _set(PROJECTS_KEY, projects);
        return project;
    }

    function updateProject(id, updates) {
        const projects = _getProjectsRaw();
        const idx = projects.findIndex(p => p.id === id);
        if (idx === -1) return null;
        Object.assign(projects[idx], updates);
        _set(PROJECTS_KEY, projects);
        return projects[idx];
    }

    function archiveProject(id) {
        return updateProject(id, { archived: true, archivedAt: new Date().toISOString() });
    }

    function restoreProject(id) {
        return updateProject(id, { archived: false, archivedAt: null });
    }

    function getArchivedProjects() {
        return _getProjectsRaw().filter(p => p.archived);
    }

    function permanentDeleteProject(id) {
        const projects = _getProjectsRaw().filter(p => p.id !== id);
        _set(PROJECTS_KEY, projects);
    }

    // --- Tasks CRUD ---

    function _getTasksRaw() {
        return _get(TASKS_KEY) || [];
    }

    function getTasks(filters) {
        let tasks = _getTasksRaw().filter(t => !t.archivedAt);
        if (filters) {
            tasks = _applyFilters(tasks, filters);
        }
        return tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    function getTask(id) {
        return _getTasksRaw().find(t => t.id === id) || null;
    }

    function getInboxTasks() {
        return _getTasksRaw()
            .filter(t => !t.archivedAt && t.projectId === null)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    function getTasksByProject(projectId) {
        return _getTasksRaw()
            .filter(t => !t.archivedAt && t.projectId === projectId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    function getTasksByClient(clientId) {
        return _getTasksRaw()
            .filter(t => !t.archivedAt && t.clientId === clientId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    function addTask(data) {
        const tasks = _getTasksRaw();
        const task = {
            id: generateId(),
            projectId: data.projectId || null,
            clientId: data.clientId || null,
            verb: data.verb || 'Anders',
            title: (data.title || '').trim(),
            note: (data.note || '').trim(),
            status: data.status || 'inbox',
            waitingFor: (data.waitingFor || '').trim(),
            important: data.important || false,
            urgent: data.urgent || false,
            energy: data.energy || null,
            deadline: data.deadline || null,
            deadlineHard: data.deadlineHard || false,
            estimateMin: data.estimateMin || null,
            actualMin: data.actualMin || null,
            context: data.context || null,
            recurring: data.recurring || 'geen',
            nextAction: data.nextAction || false,
            createdAt: new Date().toISOString(),
            completedAt: null,
            archivedAt: null,
            order: tasks.length
        };

        // Enforce nextAction constraint: max 1 per project
        if (task.nextAction && task.projectId) {
            _clearNextAction(tasks, task.projectId);
        }

        tasks.push(task);
        _set(TASKS_KEY, tasks);
        return task;
    }

    function updateTask(id, updates) {
        const tasks = _getTasksRaw();
        const idx = tasks.findIndex(t => t.id === id);
        if (idx === -1) return null;

        const task = tasks[idx];

        // Handle status → afgerond: set completedAt
        if (updates.status === 'afgerond' && task.status !== 'afgerond') {
            updates.completedAt = new Date().toISOString();
        }
        // Handle status changed away from afgerond: clear completedAt
        if (updates.status && updates.status !== 'afgerond' && task.status === 'afgerond') {
            updates.completedAt = null;
        }

        // Enforce nextAction constraint
        if (updates.nextAction === true) {
            const projectId = updates.projectId || task.projectId;
            if (projectId) {
                _clearNextAction(tasks, projectId, id);
            }
        }

        Object.assign(tasks[idx], updates);
        _set(TASKS_KEY, tasks);
        return tasks[idx];
    }

    function _clearNextAction(tasks, projectId, excludeTaskId) {
        tasks.forEach(t => {
            if (t.projectId === projectId && t.nextAction && t.id !== excludeTaskId) {
                t.nextAction = false;
            }
        });
    }

    function archiveTask(id) {
        return updateTask(id, { archivedAt: new Date().toISOString() });
    }

    function restoreTask(id) {
        return updateTask(id, { archivedAt: null });
    }

    function permanentDeleteTask(id) {
        const tasks = _getTasksRaw().filter(t => t.id !== id);
        _set(TASKS_KEY, tasks);
    }

    function getArchivedTasks() {
        return _getTasksRaw()
            .filter(t => t.archivedAt)
            .sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
    }

    // --- Batch operations ---

    function moveTasks(taskIds, projectId, clientId) {
        const tasks = _getTasksRaw();
        let changed = false;
        taskIds.forEach(taskId => {
            const idx = tasks.findIndex(t => t.id === taskId);
            if (idx !== -1) {
                tasks[idx].projectId = projectId;
                tasks[idx].clientId = clientId;
                // If task was inbox, change status to gepland
                if (tasks[idx].status === 'inbox') {
                    tasks[idx].status = 'gepland';
                }
                changed = true;
            }
        });
        if (changed) _set(TASKS_KEY, tasks);
    }

    function batchArchive(taskIds) {
        const tasks = _getTasksRaw();
        const now = new Date().toISOString();
        let changed = false;
        taskIds.forEach(taskId => {
            const idx = tasks.findIndex(t => t.id === taskId);
            if (idx !== -1) {
                tasks[idx].archivedAt = now;
                changed = true;
            }
        });
        if (changed) _set(TASKS_KEY, tasks);
    }

    // --- Volgende actie ---

    function setNextAction(taskId) {
        const tasks = _getTasksRaw();
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;

        // Toggle: if already nextAction, turn off
        if (task.nextAction) {
            task.nextAction = false;
        } else {
            // Clear other nextActions in same project
            if (task.projectId) {
                _clearNextAction(tasks, task.projectId, taskId);
            }
            task.nextAction = true;
        }

        _set(TASKS_KEY, tasks);
        return task;
    }

    // --- Recurring tasks ---

    function processRecurringTask(taskId) {
        const tasks = _getTasksRaw();
        const task = tasks.find(t => t.id === taskId);
        if (!task || task.recurring === 'geen') return null;

        // Calculate next deadline based on recurrence
        let nextDeadline = null;
        if (task.deadline) {
            const base = new Date(task.deadline + 'T00:00:00');
            switch (task.recurring) {
                case 'dagelijks':
                    base.setDate(base.getDate() + 1);
                    break;
                case 'wekelijks':
                    base.setDate(base.getDate() + 7);
                    break;
                case 'tweewekelijks':
                    base.setDate(base.getDate() + 14);
                    break;
                case 'maandelijks':
                    base.setMonth(base.getMonth() + 1);
                    break;
                case 'kwartaal':
                    base.setMonth(base.getMonth() + 3);
                    break;
            }
            nextDeadline = dateKey(base);
        }

        // Create new task as copy
        const newTask = {
            id: generateId(),
            projectId: task.projectId,
            clientId: task.clientId,
            verb: task.verb,
            title: task.title,
            note: task.note,
            status: 'gepland',
            waitingFor: '',
            important: task.important,
            urgent: task.urgent,
            energy: task.energy,
            deadline: nextDeadline,
            deadlineHard: task.deadlineHard,
            estimateMin: task.estimateMin,
            actualMin: null,
            context: task.context,
            recurring: task.recurring,
            nextAction: false,
            createdAt: new Date().toISOString(),
            completedAt: null,
            archivedAt: null,
            order: tasks.length
        };

        tasks.push(newTask);
        _set(TASKS_KEY, tasks);
        return newTask;
    }

    // --- Filtering helper ---

    function _applyFilters(tasks, filters) {
        return tasks.filter(task => {
            for (const key of Object.keys(filters)) {
                const filterVal = filters[key];
                if (filterVal === null || filterVal === undefined || filterVal === '') continue;

                if (Array.isArray(filterVal)) {
                    if (filterVal.length === 0) continue;
                    if (!filterVal.includes(task[key])) return false;
                } else {
                    if (task[key] !== filterVal) return false;
                }
            }
            return true;
        });
    }

    // --- Stats helpers (for future weekly summary) ---

    function getTaskStats(startDate, endDate) {
        const tasks = _getTasksRaw();
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null;

        const completed = tasks.filter(t => {
            if (!t.completedAt) return false;
            const d = new Date(t.completedAt);
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        });

        const created = tasks.filter(t => {
            const d = new Date(t.createdAt);
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        });

        let totalEstimate = 0;
        let totalActual = 0;
        let withEstimate = 0;
        let withActual = 0;

        completed.forEach(t => {
            if (t.estimateMin) { totalEstimate += t.estimateMin; withEstimate++; }
            if (t.actualMin) { totalActual += t.actualMin; withActual++; }
        });

        return {
            completedCount: completed.length,
            createdCount: created.length,
            totalEstimateMin: totalEstimate,
            totalActualMin: totalActual,
            deviationFactor: withEstimate > 0 && withActual > 0
                ? (totalActual / totalEstimate).toFixed(2)
                : null
        };
    }

    // --- Public API ---

    return {
        generateId,
        todayKey,
        dateKey,

        // Clients
        getClients,
        getAllClients,
        getClient,
        addClient,
        updateClient,
        archiveClient,
        restoreClient,
        getArchivedClients,
        permanentDeleteClient,

        // Projects
        getProjects,
        getAllProjects,
        getProject,
        getProjectsByClient,
        addProject,
        updateProject,
        archiveProject,
        restoreProject,
        getArchivedProjects,
        permanentDeleteProject,

        // Tasks
        getTasks,
        getTask,
        getInboxTasks,
        getTasksByProject,
        getTasksByClient,
        addTask,
        updateTask,
        archiveTask,
        restoreTask,
        permanentDeleteTask,
        getArchivedTasks,

        // Batch
        moveTasks,
        batchArchive,

        // Next action
        setNextAction,

        // Recurring
        processRecurringTask,

        // Stats
        getTaskStats
    };
})();
