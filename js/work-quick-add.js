// ============================================================
// work-quick-add.js — Full task entry form for RHLOS
// Saves tasks to shared LocalStorage (wk_tasks) for Taakmanager
// ============================================================

const WorkQuickAdd = (() => {

    function init() {
        // Nothing to initialize on startup
    }

    function render() {
        _updateSubtitle();
        _populateClientDropdown();
        _resetForm();
    }

    function _updateSubtitle() {
        const el = document.getElementById('work-subtitle');
        if (!el) return;
        const today = new Date();
        el.textContent = today.toLocaleDateString('nl-NL', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    // --- Dropdown population ---

    function _populateClientDropdown() {
        const el = document.getElementById('wk-client');
        if (!el) return;
        const clients = WorkDB.getClients();
        let html = '<option value="">— Geen (Inbox) —</option>';
        clients.forEach(c => {
            html += `<option value="${c.id}">${_esc(c.name)}</option>`;
        });
        el.innerHTML = html;
    }

    function _populateProjectDropdown(clientId) {
        const el = document.getElementById('wk-project');
        if (!el) return;
        let html = '<option value="">— Geen —</option>';
        if (clientId) {
            const projects = WorkDB.getProjectsByClient(clientId);
            projects.forEach(p => {
                html += `<option value="${p.id}">${_esc(p.name)}</option>`;
            });
        }
        el.innerHTML = html;
    }

    // --- Conditional field handlers ---

    function onClientChange() {
        const clientId = document.getElementById('wk-client').value;
        _populateProjectDropdown(clientId);
    }

    function onStatusChange() {
        const status = document.getElementById('wk-status').value;
        document.getElementById('wk-fg-waiting').style.display = status === 'wachten_op' ? '' : 'none';
    }

    function onDeadlineChange() {
        const dl = document.getElementById('wk-deadline').value;
        document.getElementById('wk-fg-deadline-type').style.display = dl ? '' : 'none';
    }

    // --- Save task ---

    function saveTask() {
        const title = document.getElementById('wk-title').value.trim();
        if (!title) { document.getElementById('wk-title').focus(); return; }

        const status = document.getElementById('wk-status').value;
        const clientId = document.getElementById('wk-client').value || null;
        const projectId = document.getElementById('wk-project').value || null;

        WorkDB.addTask({
            verb: document.getElementById('wk-verb').value,
            title: title,
            note: document.getElementById('wk-note').value.trim(),
            clientId: clientId,
            projectId: projectId,
            status: status,
            waitingFor: status === 'wachten_op' ? document.getElementById('wk-waiting').value.trim() : '',
            important: document.getElementById('wk-important').checked,
            urgent: document.getElementById('wk-urgent').checked,
            energy: document.getElementById('wk-energy').value || null,
            deadline: document.getElementById('wk-deadline').value || null,
            deadlineHard: document.getElementById('wk-deadline-type').value === 'true',
            estimateMin: document.getElementById('wk-estimate').value ? parseInt(document.getElementById('wk-estimate').value) : null,
            context: document.getElementById('wk-context').value || null,
            recurring: document.getElementById('wk-recurring').value || 'geen',
            nextAction: document.getElementById('wk-nextaction').checked
        });

        _showConfirmation();
        _resetForm();
    }

    // --- Form reset ---

    function _resetForm() {
        document.getElementById('wk-verb').value = 'Anders';
        document.getElementById('wk-title').value = '';
        document.getElementById('wk-note').value = '';
        document.getElementById('wk-client').value = '';
        _populateProjectDropdown('');
        document.getElementById('wk-status').value = 'inbox';
        document.getElementById('wk-waiting').value = '';
        document.getElementById('wk-important').checked = false;
        document.getElementById('wk-urgent').checked = false;
        document.getElementById('wk-energy').value = '';
        document.getElementById('wk-deadline').value = '';
        document.getElementById('wk-deadline-type').value = 'false';
        document.getElementById('wk-estimate').value = '';
        document.getElementById('wk-context').value = '';
        document.getElementById('wk-recurring').value = 'geen';
        document.getElementById('wk-nextaction').checked = false;

        // Hide conditional fields
        document.getElementById('wk-fg-waiting').style.display = 'none';
        document.getElementById('wk-fg-deadline-type').style.display = 'none';
    }

    // --- Confirmation ---

    function _showConfirmation() {
        const el = document.getElementById('wk-confirmation');
        if (!el) return;
        el.style.display = '';
        setTimeout(() => {
            el.style.display = 'none';
        }, 2000);
    }

    // --- Helper ---

    function _esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return {
        init,
        render,
        saveTask,
        resetForm: _resetForm,
        onClientChange,
        onStatusChange,
        onDeadlineChange
    };
})();
