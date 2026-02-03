// ============================================================
// habits-app.js — Habit Tracker UI controller
// ============================================================

const HabitsApp = (() => {

    let currentPage = 'today';
    let selectedDate = null;
    let weekOffset = 0; // 0 = current week, -1 = last week, etc.
    let calendarDate = new Date();
    let calendarHabitFilter = null; // null = all habits
    let editingHabitId = null;
    let detailHabitId = null;
    let selectedIcon = '✅';
    let selectedColor = '#007aff';

    const ICONS = ['✅','🧘','📚','💧','🏃','🍎','💊','🎯','✍️','🌅','🧹','💤','🚭','🎵','💰','🌿'];
    const COLORS = ['#007aff','#34c759','#ff9500','#ff3b30','#af52de','#5856d6','#ff2d55','#00c7be'];

    // ============================================================
    // NAVIGATION
    // ============================================================
    function showPage(pageId) {
        const panel = document.getElementById('panel-habits');
        panel.querySelectorAll('.ht-page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('#habits-tab-bar button').forEach(b => b.classList.remove('active'));

        const page = document.getElementById('ht-page-' + pageId);
        const tab = document.getElementById('ht-tab-' + pageId);
        if (page) page.classList.add('active');
        if (tab) tab.classList.add('active');

        currentPage = pageId;
        renderCurrentPage();
    }

    function renderCurrentPage() {
        switch (currentPage) {
            case 'today': renderToday(); break;
            case 'calendar': renderCalendar(); break;
            case 'stats': renderStats(); break;
            case 'manage': renderManage(); break;
        }
    }

    // ============================================================
    // TODAY VIEW — Week table grouped by category
    // ============================================================
    function renderToday() {
        // Update header date
        document.getElementById('habits-date').textContent = formatFullDate(new Date());

        // Determine the week to show (Mon-Sun), offset by weekOffset
        const todayStr = HabitsDB.todayKey();
        const todayDate = new Date(todayStr + 'T00:00:00');
        const dayOfWeek = (todayDate.getDay() + 6) % 7; // Monday = 0
        const weekStart = new Date(todayDate);
        weekStart.setDate(weekStart.getDate() - dayOfWeek + (weekOffset * 7));

        // Build array of 7 days
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            weekDays.push(HabitsDB.dateKey(d));
        }

        // Week nav label
        const weekStartDate = new Date(weekDays[0] + 'T00:00:00');
        const weekEndDate = new Date(weekDays[6] + 'T00:00:00');
        const weekLabel = weekStartDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
            + ' – ' + weekEndDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
        document.getElementById('ht-today-date').textContent = weekLabel;

        const habits = HabitsDB.getHabits();
        const container = document.getElementById('ht-habits-list');

        if (habits.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎯</div>
                    <p>Nog geen gewoontes. Maak je eerste gewoonte aan!</p>
                </div>`;
            return;
        }

        // Group habits by category
        const categories = [];
        const catMap = {};
        for (const h of habits) {
            const cat = h.category || 'OVERIG';
            if (!catMap[cat]) {
                catMap[cat] = [];
                categories.push(cat);
            }
            catMap[cat].push(h);
        }

        // Day headers (short)
        const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

        let html = '';

        for (const cat of categories) {
            html += `<div class="section-title" style="margin-top: 16px;">${_escapeHtml(cat)}</div>`;
            html += '<div class="ht-week-table">';

            // Header row
            html += '<div class="ht-week-row ht-week-header">';
            html += '<div class="ht-week-habit-cell"></div>';
            for (let i = 0; i < 7; i++) {
                const isToday = weekDays[i] === todayStr;
                const dayNum = new Date(weekDays[i] + 'T00:00:00').getDate();
                html += `<div class="ht-week-day-cell ${isToday ? 'ht-today-col' : ''}">
                    <span class="ht-day-label">${dayLabels[i]}</span>
                    <span class="ht-day-num">${dayNum}</span>
                </div>`;
            }
            html += '</div>';

            // Habit rows
            for (const habit of catMap[cat]) {
                html += '<div class="ht-week-row">';
                html += `<div class="ht-week-habit-cell" onclick="HabitsApp.openHabitDetail('${habit.id}')">
                    <span class="ht-habit-icon">${habit.icon}</span>
                    <span class="ht-habit-name">${_escapeHtml(habit.name)}</span>
                </div>`;

                for (let i = 0; i < 7; i++) {
                    const dateStr = weekDays[i];
                    const isFuture = dateStr > todayStr;
                    const isToday = dateStr === todayStr;
                    const completions = HabitsDB.getCompletionsForHabit(habit.id, dateStr);
                    const goalMet = completions.length >= habit.goal.count;

                    let cellClass = 'ht-week-check-cell';
                    if (isToday) cellClass += ' ht-today-col';
                    if (isFuture) cellClass += ' ht-future';

                    let checkHtml = '';
                    if (!isFuture) {
                        const lastCompletion = completions.length > 0 ? completions[completions.length - 1] : null;
                        const status = lastCompletion ? (lastCompletion.status || 'done') : null;
                        const isSkipped = status === 'skipped';
                        const isDone = goalMet && !isSkipped;

                        let checkClass = '';
                        let styleStr = '';
                        let symbol = '';

                        if (isDone) {
                            checkClass = 'completed';
                            styleStr = 'background: var(--green); border-color: var(--green);';
                            symbol = '✓';
                        } else if (isSkipped) {
                            checkClass = 'skipped';
                            styleStr = 'background: var(--red); border-color: var(--red);';
                            symbol = '✕';
                        }

                        checkHtml = `<button class="ht-table-check ${checkClass}"
                            style="${styleStr}"
                            onclick="HabitsApp.toggleCompletionForDate('${habit.id}', '${dateStr}')">
                            ${symbol}
                        </button>`;
                    }

                    html += `<div class="${cellClass}">${checkHtml}</div>`;
                }

                html += '</div>';
            }

            html += '</div>';
        }

        container.innerHTML = html;
    }

    function _freqLabel(freq) {
        switch (freq) {
            case 'daily': return 'vandaag';
            case 'weekly': return 'deze week';
            case 'monthly': return 'deze maand';
        }
        return '';
    }

    function toggleCompletion(habitId) {
        toggleCompletionForDate(habitId, HabitsDB.todayKey());
    }

    function toggleCompletionForDate(habitId, dateStr) {
        const habit = HabitsDB.getHabit(habitId);
        if (!habit) return;

        const completions = HabitsDB.getCompletionsForHabit(habitId, dateStr);
        const lastCompletion = completions.length > 0 ? completions[completions.length - 1] : null;
        const currentStatus = lastCompletion ? (lastCompletion.status || 'done') : null;

        // 3-state cycle: empty → done → skipped → empty
        if (!currentStatus) {
            // Empty → Done
            HabitsDB.addCompletion(dateStr, habitId, '', 'done');
            // Check for streak milestone celebration
            if (typeof StreakCelebration !== 'undefined') {
                StreakCelebration.checkAndCelebrate(habitId);
            }
        } else if (currentStatus === 'done') {
            // Done → Skipped: remove done, add skipped
            HabitsDB.removeLastCompletion(dateStr, habitId);
            HabitsDB.addCompletion(dateStr, habitId, '', 'skipped');
        } else if (currentStatus === 'skipped') {
            // Skipped → Empty: remove skipped
            HabitsDB.removeLastCompletion(dateStr, habitId);
        }
        renderToday();
    }

    function prevDay() {
        // Navigate one week back
        const todayStr = HabitsDB.todayKey();
        const todayDate = new Date(todayStr + 'T00:00:00');
        const dayOfWeek = (todayDate.getDay() + 6) % 7;
        const currentWeekStart = new Date(todayDate);
        currentWeekStart.setDate(currentWeekStart.getDate() - dayOfWeek);

        // Move weekOffset back
        weekOffset--;
        renderToday();
    }

    function nextDay() {
        if (weekOffset >= 0) return; // Don't go beyond current week
        weekOffset++;
        renderToday();
    }

    function goToToday() {
        weekOffset = 0;
        renderToday();
    }

    // ============================================================
    // CALENDAR VIEW
    // ============================================================
    function renderCalendar() {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();

        // Month title
        const monthStr = calendarDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
        document.getElementById('ht-calendar-month').textContent =
            monthStr.charAt(0).toUpperCase() + monthStr.slice(1);

        // Habit filter
        renderCalendarHabitSelect();

        // Build calendar grid
        const grid = document.getElementById('ht-calendar-grid');
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0

        const dayHeaders = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
        let html = dayHeaders.map(d => `<div class="day-header">${d}</div>`).join('');

        // Empty cells before first day
        for (let i = 0; i < startDow; i++) {
            html += '<div class="day-cell empty"></div>';
        }

        const todayStr = HabitsDB.todayKey();
        const habits = calendarHabitFilter ? [HabitsDB.getHabit(calendarHabitFilter)] : HabitsDB.getHabits();

        // Day cells
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;

            let status = '';
            if (!isFuture && habits.length > 0) {
                const completions = HabitsDB.getCompletionsForDate(dateStr);
                if (calendarHabitFilter) {
                    const habit = habits[0];
                    if (habit) {
                        const count = completions.filter(c => c.habitId === habit.id).length;
                        if (count >= habit.goal.count) status = 'completed';
                        else if (count > 0) status = 'partial';
                    }
                } else {
                    // All habits: check if all active habits met their daily goal
                    let allMet = true;
                    let anyDone = false;
                    for (const h of habits) {
                        const count = completions.filter(c => c.habitId === h.id).length;
                        if (count > 0) anyDone = true;
                        if (count < h.goal.count) allMet = false;
                    }
                    if (allMet && anyDone) status = 'completed';
                    else if (anyDone) status = 'partial';
                }
            }

            const classes = ['day-cell', status, isToday ? 'today' : '', isFuture ? 'future' : ''].filter(Boolean).join(' ');
            html += `<div class="${classes}">${day}</div>`;
        }

        grid.innerHTML = html;

        // Month summary
        renderCalendarSummary(year, month);
    }

    function renderCalendarHabitSelect() {
        const container = document.getElementById('ht-calendar-habit-select');
        const habits = HabitsDB.getHabits();

        let html = '<div class="ht-habit-filter">';
        html += `<button class="${!calendarHabitFilter ? 'active' : ''}" onclick="HabitsApp.setCalendarFilter(null)">Alles</button>`;
        for (const h of habits) {
            const active = calendarHabitFilter === h.id ? 'active' : '';
            html += `<button class="${active}" onclick="HabitsApp.setCalendarFilter('${h.id}')">${h.icon} ${_escapeHtml(h.name)}</button>`;
        }
        html += '</div>';
        container.innerHTML = html;
    }

    function renderCalendarSummary(year, month) {
        const container = document.getElementById('ht-calendar-summary');
        const lastDay = new Date(year, month + 1, 0).getDate();
        const todayStr = HabitsDB.todayKey();
        const habits = calendarHabitFilter ? [HabitsDB.getHabit(calendarHabitFilter)] : HabitsDB.getHabits();

        let completedDays = 0;
        let totalDays = 0;

        for (let day = 1; day <= lastDay; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (dateStr > todayStr) break;
            totalDays++;

            const completions = HabitsDB.getCompletionsForDate(dateStr);
            if (calendarHabitFilter) {
                const habit = habits[0];
                if (habit) {
                    const count = completions.filter(c => c.habitId === habit.id).length;
                    if (count >= habit.goal.count) completedDays++;
                }
            } else {
                let allMet = habits.length > 0;
                for (const h of habits) {
                    if (completions.filter(c => c.habitId === h.id).length < h.goal.count) {
                        allMet = false;
                        break;
                    }
                }
                if (allMet && habits.length > 0) completedDays++;
            }
        }

        const rate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
        container.innerHTML = `
            <div class="list" style="margin-top: 12px;">
                <div class="detail-row">
                    <div class="detail-content">
                        <div class="detail-label">Voltooide dagen</div>
                        <div class="detail-value">${completedDays} / ${totalDays} (${rate}%)</div>
                    </div>
                </div>
            </div>`;
    }

    function setCalendarFilter(habitId) {
        calendarHabitFilter = habitId;
        renderCalendar();
    }

    function calendarPrev() {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        renderCalendar();
    }

    function calendarNext() {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        renderCalendar();
    }

    // ============================================================
    // STATISTICS VIEW
    // ============================================================
    function renderStats() {
        const habits = HabitsDB.getHabits();
        const container = document.getElementById('ht-stats-content');

        if (habits.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <p>Maak eerst een gewoonte aan om statistieken te zien.</p>
                </div>`;
            return;
        }

        let html = '';
        for (const habit of habits) {
            const stats = HabitsDB.getHabitStats(habit.id);

            // 7-day bar chart
            const bars = _buildWeekBars(habit);

            html += `
                <div class="list" style="margin-bottom: 16px;">
                    <div class="detail-row" style="border-bottom: 1px solid var(--border);">
                        <span class="detail-icon">${habit.icon}</span>
                        <div class="detail-content">
                            <div class="detail-value">${_escapeHtml(habit.name)}</div>
                            <div class="detail-label">${habit.goal.count}x per ${_freqLabelShort(habit.goal.frequency)}</div>
                        </div>
                    </div>
                    <div style="padding: 12px 16px;">
                        <div style="display: flex; gap: 16px; margin-bottom: 12px;">
                            <div>
                                <div class="detail-label">Huidige streak</div>
                                <div style="font-size: 20px; font-weight: 700; color: var(--orange);">🔥 ${stats.currentStreak}</div>
                            </div>
                            <div>
                                <div class="detail-label">Langste streak</div>
                                <div style="font-size: 20px; font-weight: 700;">🏆 ${stats.longestStreak}</div>
                            </div>
                        </div>
                        <div class="detail-label" style="margin-bottom: 4px;">Laatste 7 dagen</div>
                        <div class="ht-bar-chart">
                            ${bars}
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 8px;">
                            <div class="ht-stat-pill">Week: ${stats.rateWeek}%</div>
                            <div class="ht-stat-pill">Maand: ${stats.rateMonth}%</div>
                            <div class="ht-stat-pill">Totaal: ${stats.rateAll}%</div>
                        </div>
                    </div>
                </div>`;
        }

        container.innerHTML = html;
    }

    function _buildWeekBars(habit) {
        const today = HabitsDB.todayKey();
        const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
        let bars = '';
        const maxCount = habit.goal.count;

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today + 'T00:00:00');
            d.setDate(d.getDate() - i);
            const dateStr = HabitsDB.dateKey(d);
            const count = HabitsDB.getCompletionsForHabit(habit.id, dateStr).length;
            const pct = maxCount > 0 ? Math.min(100, (count / maxCount) * 100) : 0;
            const dow = (d.getDay() + 6) % 7;
            const isToday = dateStr === today;
            const color = pct >= 100 ? habit.color : 'var(--border)';

            bars += `
                <div class="bar-col">
                    <div class="bar" style="height: ${Math.max(4, pct)}%; background: ${color};"></div>
                    <div class="bar-label${isToday ? ' bar-today' : ''}">${dayLabels[dow]}</div>
                </div>`;
        }
        return bars;
    }

    function _freqLabelShort(freq) {
        switch (freq) {
            case 'daily': return 'dag';
            case 'weekly': return 'week';
            case 'monthly': return 'maand';
        }
        return '';
    }

    // ============================================================
    // MANAGE VIEW
    // ============================================================
    function renderManage() {
        const habits = HabitsDB.getHabits();
        const archived = HabitsDB.getAllHabits().filter(h => h.archived);
        const container = document.getElementById('ht-manage-list');

        let html = '<div class="section-title">Actieve gewoontes</div>';

        if (habits.length === 0) {
            html += `<div class="empty-state"><div class="empty-icon">🎯</div><p>Geen actieve gewoontes</p></div>`;
        } else {
            html += '<div class="list">';
            for (const h of habits) {
                html += `
                    <div class="list-item">
                        <span class="item-icon">${h.icon}</span>
                        <div class="item-content">
                            <div class="item-title">${_escapeHtml(h.name)}</div>
                            <div class="item-subtitle">${h.goal.count}x per ${_freqLabelShort(h.goal.frequency)}${h.category ? ' · ' + _escapeHtml(h.category) : ''}</div>
                        </div>
                        <button class="btn-small btn-outline" onclick="HabitsApp.openEditHabitModal('${h.id}')" style="margin-right: 6px; padding: 4px 10px; font-size: 12px;">✎</button>
                        <button class="btn-small btn-danger" onclick="HabitsApp.archiveHabit('${h.id}')" style="padding: 4px 10px; font-size: 12px;">✕</button>
                    </div>`;
            }
            html += '</div>';
        }

        if (archived.length > 0) {
            html += '<div class="section-title mt-16">Gearchiveerd</div><div class="list">';
            for (const h of archived) {
                html += `
                    <div class="list-item">
                        <span class="item-icon" style="opacity: 0.5;">${h.icon}</span>
                        <div class="item-content">
                            <div class="item-title" style="opacity: 0.5;">${_escapeHtml(h.name)}</div>
                        </div>
                        <button class="btn-small btn-primary" onclick="HabitsApp.restoreHabit('${h.id}')" style="padding: 4px 10px; font-size: 12px;">Herstel</button>
                    </div>`;
            }
            html += '</div>';
        }

        container.innerHTML = html;
    }

    function archiveHabit(id) {
        if (!confirm('Weet je zeker dat je deze gewoonte wilt archiveren?')) return;
        HabitsDB.deleteHabit(id);
        renderManage();
        if (currentPage === 'today') renderToday();
    }

    function restoreHabit(id) {
        HabitsDB.restoreHabit(id);
        renderManage();
    }

    // ============================================================
    // ADD/EDIT HABIT MODAL
    // ============================================================
    function openAddHabitModal() {
        editingHabitId = null;
        document.getElementById('habit-modal-title').textContent = 'Nieuwe Gewoonte';
        document.getElementById('input-habit-name').value = '';
        document.getElementById('input-habit-goal-count').value = '1';
        document.getElementById('input-habit-frequency').value = 'daily';
        document.getElementById('input-habit-category').value = '';
        selectedIcon = '✅';
        selectedColor = '#007aff';
        _renderIconPicker();
        _renderColorPicker();
        _openModal('modal-habit-edit');
        document.getElementById('input-habit-name').focus();
    }

    function openEditHabitModal(habitId) {
        const habit = HabitsDB.getHabit(habitId);
        if (!habit) return;
        editingHabitId = habitId;
        document.getElementById('habit-modal-title').textContent = 'Gewoonte Bewerken';
        document.getElementById('input-habit-name').value = habit.name;
        document.getElementById('input-habit-goal-count').value = habit.goal.count;
        document.getElementById('input-habit-frequency').value = habit.goal.frequency;
        document.getElementById('input-habit-category').value = habit.category || '';
        selectedIcon = habit.icon;
        selectedColor = habit.color;
        _renderIconPicker();
        _renderColorPicker();
        _openModal('modal-habit-edit');
    }

    function saveHabit() {
        const name = document.getElementById('input-habit-name').value.trim();
        if (!name) return;
        const goalCount = parseInt(document.getElementById('input-habit-goal-count').value) || 1;
        const frequency = document.getElementById('input-habit-frequency').value;
        const category = document.getElementById('input-habit-category').value.trim();

        if (editingHabitId) {
            HabitsDB.updateHabit(editingHabitId, {
                name, icon: selectedIcon, color: selectedColor, category,
                goal: { frequency, count: goalCount },
            });
        } else {
            HabitsDB.addHabit(name, selectedIcon, selectedColor, category, frequency, goalCount);
        }

        closeModal('modal-habit-edit');
        renderCurrentPage();
    }

    function selectIcon(icon) {
        selectedIcon = icon;
        _renderIconPicker();
    }

    function selectColor(color) {
        selectedColor = color;
        _renderColorPicker();
    }

    function _renderIconPicker() {
        const container = document.getElementById('habit-icon-picker');
        container.innerHTML = ICONS.map(icon =>
            `<button type="button" class="${icon === selectedIcon ? 'selected' : ''}" onclick="HabitsApp.selectIcon('${icon}')">${icon}</button>`
        ).join('');
    }

    function _renderColorPicker() {
        const container = document.getElementById('habit-color-picker');
        container.innerHTML = COLORS.map(color =>
            `<button type="button" class="${color === selectedColor ? 'selected' : ''}" style="background: ${color};" onclick="HabitsApp.selectColor('${color}')"></button>`
        ).join('');
    }

    // ============================================================
    // HABIT DETAIL MODAL
    // ============================================================
    function openHabitDetail(habitId) {
        detailHabitId = habitId;
        const habit = HabitsDB.getHabit(habitId);
        if (!habit) return;

        document.getElementById('habit-detail-title').textContent = habit.icon + ' ' + habit.name;

        const stats = HabitsDB.getHabitStats(habitId);
        const container = document.getElementById('habit-detail-content');

        // Mini 7-day overview
        const today = HabitsDB.todayKey();
        let miniDays = '';
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today + 'T00:00:00');
            d.setDate(d.getDate() - i);
            const dateStr = HabitsDB.dateKey(d);
            const count = HabitsDB.getCompletionsForHabit(habitId, dateStr).length;
            const met = count >= habit.goal.count;
            const dayLabel = d.toLocaleDateString('nl-NL', { weekday: 'short' }).slice(0, 2);
            miniDays += `<div class="ht-mini-day ${met ? 'completed' : (count > 0 ? 'partial' : '')}" style="${met ? 'background:' + habit.color : ''}">${dayLabel}</div>`;
        }

        container.innerHTML = `
            <div class="ht-mini-week">${miniDays}</div>
            <div class="list" style="margin-top: 12px;">
                <div class="detail-row">
                    <div class="detail-content">
                        <div class="detail-label">Doel</div>
                        <div class="detail-value">${habit.goal.count}x per ${_freqLabelShort(habit.goal.frequency)}</div>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-content">
                        <div class="detail-label">Huidige streak</div>
                        <div class="detail-value">🔥 ${stats.currentStreak} ${stats.currentStreak === 1 ? 'dag' : 'dagen'}</div>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-content">
                        <div class="detail-label">Langste streak</div>
                        <div class="detail-value">🏆 ${stats.longestStreak} ${stats.longestStreak === 1 ? 'dag' : 'dagen'}</div>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-content">
                        <div class="detail-label">Voltooingspercentage</div>
                        <div class="detail-value">Week ${stats.rateWeek}% · Maand ${stats.rateMonth}% · Totaal ${stats.rateAll}%</div>
                    </div>
                </div>
            </div>`;

        _openModal('modal-habit-detail');
    }

    function editCurrentHabit() {
        closeModal('modal-habit-detail');
        if (detailHabitId) openEditHabitModal(detailHabitId);
    }

    function deleteCurrentHabit() {
        if (!detailHabitId) return;
        if (!confirm('Weet je zeker dat je deze gewoonte wilt archiveren?')) return;
        HabitsDB.deleteHabit(detailHabitId);
        closeModal('modal-habit-detail');
        renderCurrentPage();
    }

    // ============================================================
    // MODAL HELPERS
    // ============================================================
    function _openModal(id) {
        document.getElementById(id).classList.add('open');
    }

    function closeModal(id) {
        document.getElementById(id).classList.remove('open');
    }

    // ============================================================
    // HELPERS
    // ============================================================
    function _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatFullDate(date) {
        return date.toLocaleDateString('nl-NL', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    // ============================================================
    // INIT
    // ============================================================
    function init() {
        HabitsDB.seedDefaults();
        HabitsDB.migrate();
        selectedDate = null;
        weekOffset = 0;
        calendarDate = new Date();
        showPage('today');
    }

    // ============================================================
    // PUBLIC API
    // ============================================================
    return {
        init,
        showPage,
        renderCurrentPage,
        // Today
        toggleCompletion,
        toggleCompletionForDate,
        prevDay,
        nextDay,
        goToToday,
        // Calendar
        setCalendarFilter,
        calendarPrev,
        calendarNext,
        // Manage
        archiveHabit,
        restoreHabit,
        // Add/Edit modal
        openAddHabitModal,
        openEditHabitModal,
        saveHabit,
        selectIcon,
        selectColor,
        // Detail modal
        openHabitDetail,
        editCurrentHabit,
        deleteCurrentHabit,
        closeModal,
    };
})();
