(function () {
  const COLORS = ['#1B5E3B', '#2C5282', '#2D8B5E', '#3B6FA0', '#145232', '#1A365D', '#D4A04A', '#C75B3B'];
  const PRIORITY_COLORS = { low: '#2D8B5E', medium: '#D4A04A', high: '#C75B3B' };

  var state = { user: null, projects: [], tasks: [], team: [], events: [] };

  function setState(key, val) { state[key] = val; }

  function loadAllData() {
    if (!API.isLoggedIn()) return Promise.resolve();
    return Promise.all([
      API.get('/user').then(function (u) { state.user = u; }).catch(function () {}),
      API.get('/projects').then(function (d) { state.projects = d; }).catch(function () {}),
      API.get('/tasks').then(function (d) { state.tasks = d; }).catch(function () {}),
      API.get('/team').then(function (d) { state.team = d; }).catch(function () {}),
      API.get('/events').then(function (d) { state.events = d; }).catch(function () {}),
    ]);
  }

  function getInitials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function debounce(fn, delay) {
    let timer;
    return function () {
      const context = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(context, args); }, delay);
    };
  }

  function getProjectTaskStats(data) {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const stats = {};
    data.tasks.forEach(function (t) {
      if (!stats[t.projectId]) stats[t.projectId] = { total: 0, done: 0, overdue: 0 };
      stats[t.projectId].total++;
      if (t.status === 'done') stats[t.projectId].done++;
      if (t.dueDate && new Date(t.dueDate) < now && t.status !== 'done') stats[t.projectId].overdue++;
    });
    return stats;
  }

  function getData() { return state; }

  function saveData() {
    var indicator = document.getElementById('save-indicator');
    if (indicator) {
      indicator.textContent = 'Saved';
      indicator.classList.add('visible');
      setTimeout(function () { indicator.classList.remove('visible'); }, 2000);
    }
  }

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function updateUserInfo() {
    const data = getData();
    if (!data.user) return;
    const initials = getInitials(data.user.name);
    const color = COLORS[0];
    const hasPhoto = data.user.photo && data.user.photo.length > 0;
    const sb = document.getElementById('sidebar-user-avatar');
    const sn = document.getElementById('sidebar-user-name');
    const tn = document.getElementById('top-nav-avatar');
    const g = document.getElementById('dashboard-greeting');
    const sa = document.getElementById('settings-avatar');
    const saImg = document.getElementById('settings-avatar-img');
    const si = document.getElementById('settings-name');
    if (sb) { 
      sb.textContent = hasPhoto ? '' : initials;
      sb.style.backgroundImage = hasPhoto ? `url(${data.user.photo})` : '';
      sb.style.backgroundSize = hasPhoto ? 'cover' : '';
      sb.style.backgroundPosition = hasPhoto ? 'center' : '';
    }
    if (sn) sn.textContent = data.user.name;
    if (tn) { 
      tn.textContent = hasPhoto ? '' : initials;
      tn.style.backgroundImage = hasPhoto ? `url(${data.user.photo})` : '';
      tn.style.backgroundSize = hasPhoto ? 'cover' : '';
      tn.style.backgroundPosition = hasPhoto ? 'center' : '';
    }
    if (g) g.textContent = getGreeting() + ', ' + data.user.name.split(' ')[0];
    if (sa) { sa.textContent = initials; if (!hasPhoto) sa.style.display = ''; }
    if (saImg) {
      if (hasPhoto) { saImg.style.backgroundImage = `url(${data.user.photo})`; saImg.classList.add('visible'); }
      else { saImg.style.backgroundImage = ''; saImg.classList.remove('visible'); }
    }
    if (si) si.value = data.user.name;
    updateRemovePhotoVisibility(hasPhoto);
    document.getElementById('ws-dropdown-name') && (document.getElementById('ws-dropdown-name').textContent = data.user.name);
    document.getElementById('ws-dropdown-email') && (document.getElementById('ws-dropdown-email').textContent = data.user.email || '');
    document.getElementById('ws-dropdown-avatar') && (document.getElementById('ws-dropdown-avatar').textContent = initials);
    document.getElementById('user-dropdown-name') && (document.getElementById('user-dropdown-name').textContent = data.user.name);
    document.getElementById('user-dropdown-email') && (document.getElementById('user-dropdown-email').textContent = data.user.email || '');
    document.getElementById('user-dropdown-avatar') && (document.getElementById('user-dropdown-avatar').textContent = initials);
  }

  function updateRemovePhotoVisibility(hasPhoto) {
    const removeBtn = document.getElementById('remove-photo-btn');
    if (removeBtn) removeBtn.style.display = hasPhoto ? '' : 'none';
  }

  function saveProfilePhoto(base64) {
    const data = getData();
    if (!data.user) return;
    data.user.photo = base64;
    saveData(data);
    updateUserInfo();
  }

  function removeProfilePhoto() {
    const data = getData();
    if (!data.user) return;
    delete data.user.photo;
    saveData(data);
    updateUserInfo();
    showToast('Profile photo removed');
  }

  function setPhotoFromFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please select an image file', 'warning');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      saveProfilePhoto(e.target.result);
      showToast('Profile photo updated', 'success');
    };
    reader.onerror = function() {
      showToast('Failed to read file', 'error');
    };
    reader.readAsDataURL(file);
  }

  function setPhotoFromURL(url) {
    if (!url || !url.trim()) {
      showToast('Please enter a URL', 'warning');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const maxSize = 400;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
      else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      saveProfilePhoto(canvas.toDataURL('image/jpeg', 0.85));
      showToast('Profile photo imported', 'success');
    };
    img.onerror = function() {
      showToast('Could not load image from URL', 'error');
    };
    img.src = url.trim();
  }

  function initProfilePicture() {
    const zone = document.getElementById('profile-picture-zone');
    const display = document.getElementById('profile-picture-display');
    const fileInput = document.getElementById('profile-picture-input');
    const uploadPCBtn = document.getElementById('upload-pc-btn');
    const uploadURLBtn = document.getElementById('upload-url-btn');
    const removeBtn = document.getElementById('remove-photo-btn');
    const urlRow = document.getElementById('profile-url-row');
    const urlInput = document.getElementById('profile-url-input');
    const urlSubmit = document.getElementById('profile-url-submit');
    const urlCancel = document.getElementById('profile-url-cancel');

    uploadPCBtn?.addEventListener('click', () => fileInput?.click());
    display?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        setPhotoFromFile(e.target.files[0]);
        fileInput.value = '';
      }
    });

    uploadURLBtn?.addEventListener('click', () => {
      if (urlRow) urlRow.style.display = 'flex';
      setTimeout(() => urlInput?.focus(), 50);
    });

    urlCancel?.addEventListener('click', () => {
      if (urlRow) urlRow.style.display = 'none';
      if (urlInput) urlInput.value = '';
    });

    urlSubmit?.addEventListener('click', () => {
      if (urlInput) {
        setPhotoFromURL(urlInput.value);
        if (urlRow) urlRow.style.display = 'none';
        urlInput.value = '';
      }
    });

    urlInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') urlSubmit?.click();
    });

    removeBtn?.addEventListener('click', () => {
      removeProfilePhoto();
    });

    if (zone && display) {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        zone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      });

      ['dragenter', 'dragover'].forEach(evt => {
        zone.addEventListener(evt, () => zone.classList.add('drag-over'));
      });

      ['dragleave', 'drop'].forEach(evt => {
        zone.addEventListener(evt, () => zone.classList.remove('drag-over'));
      });

      zone.addEventListener('drop', (e) => {
        zone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          setPhotoFromFile(e.dataTransfer.files[0]);
        }
      });
    }
  }

  function updateProjectCount() {
    const data = getData();
    const badge = document.getElementById('sidebar-project-count');
    if (badge) badge.textContent = data.projects.length;
    const taskBadge = document.getElementById('sidebar-task-count');
    if (taskBadge) taskBadge.textContent = data.tasks.length;
    const teamBadge = document.getElementById('sidebar-team-count');
    if (teamBadge) teamBadge.textContent = data.team.length;
  }

  function updateCommandPaletteProjects() {
    const data = getData();
    const container = document.getElementById('command-palette-projects');
    if (!container) return;
    if (data.projects.length > 0) {
      let h = '<div class="command-group-title">Projects</div>';
      data.projects.forEach(p => {
        h += `<div class="command-item" data-project-id="${p.id}"><div class="sidebar-dot" style="background:${p.color};width:12px;height:12px;"></div><span>${p.name}</span></div>`;
      });
      container.innerHTML = h;
    } else {
      container.innerHTML = '';
    }
  }

  function renderEmptyState(title, desc, btnText, btnId) {
    return `<div class="empty-state"><div class="empty-state-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></div><h3 class="empty-state-title">${title}</h3><p class="empty-state-desc">${desc}</p><button class="empty-state-btn" id="${btnId}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>${btnText}</button></div>`;
  }

  function renderDashboard() {
    const data = getData();
    const container = document.getElementById('dashboard-content');
    if (!container) return;
    if (data.projects.length === 0) {
      container.innerHTML = renderEmptyState('No projects yet', 'Create your first project to start organizing your work.', 'Create Project', 'empty-create-project');
      document.getElementById('empty-create-project')?.addEventListener('click', () => openProjectDrawerCreate());
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    var urgentTasks = [];
    var completedTasks = 0;
    var overdueCount = 0;
    var dueToday = 0;
    data.tasks.forEach(function(t) {
      if (t.status === 'done') { completedTasks++; return; }
      if (!t.dueDate) return;
      if (t.dueDate <= today) urgentTasks.push(t);
      if (t.dueDate < today) overdueCount++;
      if (t.dueDate === today) dueToday++;
    });
    const totalTasks = data.tasks.length;
    const rate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    var bannerHtml = '';
    if (urgentTasks.length > 0) {
      var task = urgentTasks[0];
      var isOverdue = task.dueDate < today;
      bannerHtml = '<div class="dashboard-banner ' + (isOverdue ? 'overdue' : 'due-today') + '"><div class="dashboard-banner-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></div><div class="dashboard-banner-content"><span class="dashboard-banner-title">' + (isOverdue ? 'Task Overdue' : 'Due Today') + '</span><span class="dashboard-banner-desc">' + task.name + '</span></div><button class="btn btn-sm btn-primary dashboard-banner-btn" data-task-id="' + task.id + '">View Task</button></div>';
    }

    var html = bannerHtml + '<div class="stats-row anim-stagger"><div class="stat-card anim-fade-up"><div class="stat-card-header"><span class="stat-card-label">Total Projects</span></div><div class="stat-card-value">' + data.projects.length + '</div></div><div class="stat-card anim-fade-up"><div class="stat-card-header"><span class="stat-card-label">Total Tasks</span></div><div class="stat-card-value">' + totalTasks + '</div></div><div class="stat-card anim-fade-up"><div class="stat-card-header"><span class="stat-card-label">Completion Rate</span></div><div class="stat-card-value">' + rate + '%</div></div><div class="stat-card anim-fade-up"><div class="stat-card-header"><span class="stat-card-label">Team Members</span></div><div class="stat-card-value">' + data.team.length + '</div></div></div>';

    if (overdueCount > 0 || dueToday > 0) {
      html += '<div class="quick-actions"><div class="section-header"><h2 class="section-title">Quick Actions</h2></div><div class="quick-actions-grid">';
      if (overdueCount > 0) html += '<div class="quick-action-card danger"><div class="quick-action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></div><div><strong>' + overdueCount + ' overdue</strong> tasks need attention</div></div>';
      if (dueToday > 0) html += '<div class="quick-action-card warning"><div class="quick-action-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div><div><strong>' + dueToday + ' tasks</strong> due today</div></div>';
      html += '</div></div>';
    }

    html += '<div class="dashboard-grid"><div class="dashboard-main"><div class="section"><div class="section-header"><h2 class="section-title">Your Projects</h2></div><div class="project-cards-grid">';
    var dashStats = getProjectTaskStats(data);
    data.projects.forEach(function(p, i) {
      var stats = dashStats[p.id] || { total: 0, done: 0, overdue: 0 };
      var prog = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
      var sLabel = stats.overdue > 0 ? stats.overdue + ' overdue' : (stats.total === 0 ? 'Empty' : prog + '% complete');
      var sClass = stats.overdue > 0 ? 'badge-danger' : (prog === 100 ? 'badge-success' : 'badge-info');
      var sIcon = stats.overdue > 0 ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>' : (prog === 100 ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>' : '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>');
      html += '<article class="project-card" data-project-id="' + p.id + '" style="animation-delay:' + (i * 50) + 'ms;"><div class="project-card-color" style="background:' + p.color + ';"></div><div class="project-card-body"><div class="project-card-header"><h3 class="project-card-title">' + p.name + '</h3><span class="badge ' + sClass + ' project-status-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;">' + sIcon + '</svg>' + sLabel + '</span></div>' + (stats.total > 0 ? '<div class="progress-bar" role="progressbar" aria-valuenow="' + prog + '" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar-fill" style="width:' + prog + '%;background:' + p.color + ';" aria-hidden="true"></div></div>' : '') + '<div class="project-card-meta"><span class="project-card-task-count"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>' + stats.total + ' task' + (stats.total !== 1 ? 's' : '') + '</span>' + (data.team.length > 0 && stats.total > 0 ? '<span class="project-card-members"><div class="avatar-stack" style="display:inline-flex;vertical-align:middle;">' + data.team.slice(0, 3).map(function(m, j) { return '<div class="avatar avatar-xs" style="background:' + (m.color || 'var(--primary)') + ';margin-left:' + (j === 0 ? 0 : '-8px') + ';border:' + (j === 0 ? 'none' : '2px solid var(--bg-primary)') + ';" title="' + m.name + '">' + m.name.split(' ').map(function(w2) { return w2[0]; }).join('').toUpperCase().slice(0, 2) + '</div>'; }).join('') + (data.team.length > 3 ? '<div class="avatar avatar-xs" style="background:var(--bg-tertiary);color:var(--text-secondary);margin-left:-8px;border:2px solid var(--bg-primary);font-size:9px;">+' + (data.team.length - 3) + '</div>' : '') + '</div></span>' : '') + '</div></div></article>';
    });
    html += '</div></div></div><div class="dashboard-side"><div class="widget"><div class="widget-header"><h3 class="widget-title">Recent Activity</h3></div><div id="dashboard-activity"></div></div></div></div>';
    container.innerHTML = html;
    renderActivityFeed(document.getElementById('dashboard-activity'));
    container.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', () => navigateTo('project-detail', card.dataset.projectId));
    });
    container.querySelector('.dashboard-banner-btn')?.addEventListener('click', (e) => {
      openTaskDrawerEdit(e.target.dataset.taskId);
    });
  }

  function renderProjects() {
    var data = getData();
    var container = document.getElementById('projects-content');
    if (!container) return;
    var searchQuery = document.getElementById('projects-search') && document.getElementById('projects-search').value.toLowerCase() || '';
    var projects = data.projects;
    if (searchQuery) projects = projects.filter(function (p) { return p.name.toLowerCase().includes(searchQuery); });
    if (projects.length === 0 && !searchQuery) {
      container.innerHTML = renderEmptyState('No projects yet', 'Create your first project to start organizing your work.', 'Create Project', 'empty-create-project-2');
      document.getElementById('empty-create-project-2') && document.getElementById('empty-create-project-2').addEventListener('click', function () { openProjectDrawerCreate(); });
      return;
    }
    if (projects.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div><h3 class="empty-state-title">No matches</h3><p class="empty-state-desc">Try a different search term.</p></div>';
      return;
    }
    var taskStats = getProjectTaskStats(data);
    var html = '<div class="projects-grid">';
    projects.forEach(function(p, i) {
      var stats = taskStats[p.id] || { total: 0, done: 0, overdue: 0 };
      var prog = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
      var sLabel = stats.overdue > 0 ? stats.overdue + ' overdue' : (stats.total === 0 ? 'Empty' : prog + '% complete');
      var sClass = stats.overdue > 0 ? 'badge-danger' : (prog === 100 ? 'badge-success' : 'badge-info');
      var sIcon = stats.overdue > 0 ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>' : (prog === 100 ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>' : '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>');
      html += `<article class="project-card-large" data-project-id="${p.id}" style="animation-delay:${i * 50}ms;"><div class="project-card-color" style="background:${p.color};"></div><div class="project-card-body"><div class="project-card-large-header"><h3 class="project-card-title">${p.name}</h3><div class="project-card-actions"><button class="btn-icon-small edit-project-btn" data-project-id="${p.id}" title="Edit project"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button><button class="btn-icon-small delete-project-btn" data-project-id="${p.id}" title="Delete project" style="color:var(--danger);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div><span class="badge ${sClass} project-status-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;">${sIcon}</svg>${sLabel}</span></div>${stats.total > 0 ? `<div class="progress-bar" role="progressbar" aria-valuenow="${prog}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar-fill" style="width:${prog}%;background:${p.color};" aria-hidden="true"></div></div>` : ''}<div class="project-card-meta"><span class="project-card-task-count"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>${stats.total} task${stats.total !== 1 ? 's' : ''}</span>${data.team.length > 0 && stats.total > 0 ? `<span class="project-card-members"><div class="avatar-stack" style="display:inline-flex;vertical-align:middle;">${data.team.slice(0, 3).map((m, j) => `<div class="avatar avatar-xs" style="background:${m.color || 'var(--primary)'};margin-left:${j === 0 ? 0 : '-8px'};border:${j === 0 ? 'none' : '2px solid var(--bg-primary)'};" title="${m.name}">${m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</div>`).join('')}${data.team.length > 3 ? `<div class="avatar avatar-xs" style="background:var(--bg-tertiary);color:var(--text-secondary);margin-left:-8px;border:2px solid var(--bg-primary);font-size:9px;">+${data.team.length - 3}</div>` : ''}</div></span>` : ''}</div></div></article>`;
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.project-card-large').forEach(card => {
      card.addEventListener('click', () => navigateTo('project-detail', card.dataset.projectId));
    });
    container.querySelectorAll('.edit-project-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openProjectDrawerEdit(btn.dataset.projectId); });
    });
    container.querySelectorAll('.delete-project-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); if (confirm('Delete this project and all its tasks?')) deleteProject(btn.dataset.projectId); });
    });
  }

  function renderProjectDetail(projectId) {
    const data = getData();
    const project = data.projects.find(p => p.id === projectId);
    const container = document.getElementById('project-detail-content');
    const titleEl = document.getElementById('project-detail-title');
    const subtitleEl = document.getElementById('project-detail-subtitle');
    if (!project) {
      if (titleEl) titleEl.textContent = 'Project not found';
      if (subtitleEl) subtitleEl.textContent = '';
      if (container) container.innerHTML = renderEmptyState('Project not found', "This project doesn't exist or was deleted.", 'Back to Projects', 'empty-back-projects');
      document.getElementById('empty-back-projects')?.addEventListener('click', () => navigateTo('projects'));
      return;
    }
    const projectTasks = data.tasks.filter(t => t.projectId === projectId);
    if (titleEl) titleEl.textContent = project.name;
    if (subtitleEl) subtitleEl.textContent = `${projectTasks.length} tasks`;
    if (!container) return;
    if (projectTasks.length === 0) {
      container.innerHTML = renderEmptyState('No tasks yet', 'Add your first task to this project.', 'Add Task', 'empty-add-task');
      document.getElementById('empty-add-task')?.addEventListener('click', () => openTaskDrawerCreate(projectId));
      return;
    }
    const statuses = ['backlog', 'todo', 'inprogress', 'review', 'done'];
    const sLabels = { backlog: 'Backlog', todo: 'To Do', inprogress: 'In Progress', review: 'In Review', done: 'Done' };
    const sColors = { backlog: 'var(--text-tertiary)', todo: 'var(--text-secondary)', inprogress: 'var(--primary)', review: 'var(--warning)', done: 'var(--success)' };
    let html = '<div class="kanban-board">';
    statuses.forEach(status => {
      const tasks = projectTasks.filter(t => t.status === status);
      html += `<div class="kanban-column"><div class="kanban-column-header"><div class="flex items-center gap-2"><div class="kanban-dot" style="background:${sColors[status]};"></div><span class="kanban-column-title">${sLabels[status]}</span></div><span class="kanban-count">${tasks.length}</span></div><div class="kanban-cards" data-status="${status}">`;
      tasks.forEach(task => {
        const assignee = task.assigneeId ? data.team.find(m => m.id === task.assigneeId) : null;
        html += `<div class="kanban-card" draggable="true" data-task-id="${task.id}"><div class="kanban-card-title">${task.name}</div>${task.description ? `<p class="kanban-card-desc">${task.description}</p>` : ''}${task.dueDate || assignee ? `<div class="kanban-card-footer">${task.dueDate ? `<span class="kanban-card-due">${task.dueDate}</span>` : '<span></span>'}${assignee ? `<div class="avatar avatar-xs" style="background:${assignee.color || 'var(--primary)'};" title="${assignee.name}">${getInitials(assignee.name)}</div>` : ''}</div>` : ''}</div>`;
      });
      html += `</div><button class="kanban-add-btn" data-status="${status}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Add task</button></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.kanban-add-btn').forEach(btn => {
      btn.addEventListener('click', () => openTaskDrawerCreate(projectId, btn.dataset.status));
    });
    initKanbanDrag();
    initTaskItemListeners();
  }

  function renderTasks() {
    const data = getData();
    const container = document.getElementById('tasks-content');
    const subtitle = document.getElementById('tasks-subtitle');
    if (!container) return;

    const searchQuery = document.getElementById('tasks-search')?.value?.toLowerCase() || '';
    const activeFilter = document.querySelector('#tasks-filter-bar .filter-chip.active')?.dataset.filter || 'all';
    const sortBy = document.getElementById('tasks-sort')?.value || 'due-asc';

    let filteredTasks = [...data.tasks];
    if (searchQuery) {
      filteredTasks = filteredTasks.filter(t => t.name.toLowerCase().includes(searchQuery) || (t.description && t.description.toLowerCase().includes(searchQuery)));
    }
    if (activeFilter !== 'all') {
      filteredTasks = filteredTasks.filter(t => t.status === activeFilter);
    }

    const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
    if (sortBy === 'due-asc') filteredTasks.sort((a, b) => (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1);
    else if (sortBy === 'due-desc') filteredTasks.sort((a, b) => (a.dueDate || '0000') > (b.dueDate || '0000') ? -1 : 1);
    else if (sortBy === 'priority') filteredTasks.sort((a, b) => (PRIORITY_ORDER[a.priority] || 2) - (PRIORITY_ORDER[b.priority] || 2));
    else if (sortBy === 'created') filteredTasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (sortBy === 'name') filteredTasks.sort((a, b) => a.name.localeCompare(b.name));

    if (data.tasks.length === 0) {
      if (subtitle) subtitle.textContent = 'No tasks yet';
      container.innerHTML = renderEmptyState('No tasks yet', 'Create tasks to track your work across projects.', 'New Task', 'empty-new-task');
      document.getElementById('empty-new-task')?.addEventListener('click', () => {
        if (data.projects.length > 0) openTaskDrawerCreate(data.projects[0].id);
        else { showToast('Create a project first'); navigateTo('projects'); }
      });
      return;
    }
    if (subtitle) subtitle.textContent = `${filteredTasks.length} of ${data.tasks.length} tasks`;
    if (filteredTasks.length === 0 && data.tasks.length > 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div><h3 class="empty-state-title">No matches</h3><p class="empty-state-desc">Try adjusting your search or filters.</p></div>`;
      return;
    }

    let html = '<div id="tasks-bulk-actions" style="display:none;margin-bottom:var(--space-3);display:none;align-items:center;gap:var(--space-2);"><span id="tasks-selected-count" style="font-size:var(--text-sm);color:var(--text-secondary);"></span><button class="btn btn-sm btn-danger" id="bulk-delete-tasks">Delete Selected</button><button class="btn btn-sm btn-outline" id="bulk-clear-tasks">Clear Selection</button></div><div class="task-groups">';
    const groupedByProject = {};
    filteredTasks.forEach(t => {
      if (!groupedByProject[t.projectId]) groupedByProject[t.projectId] = [];
      groupedByProject[t.projectId].push(t);
    });
    let selectedTaskIds = [];
    function updateBulkUI() {
      const bar = document.getElementById('tasks-bulk-actions');
      const countEl = document.getElementById('tasks-selected-count');
      if (!bar || !countEl) return;
      if (selectedTaskIds.length > 0) {
        bar.style.display = 'flex';
        countEl.textContent = `${selectedTaskIds.length} selected`;
      } else {
        bar.style.display = 'none';
      }
    }

    for (const [projectId, tasks] of Object.entries(groupedByProject)) {
      const p = data.projects.find(pr => pr.id === projectId);
      if (!p) continue;
      html += `<div class="task-group"><div class="task-group-header"><div class="flex items-center gap-3"><div class="sidebar-dot" style="background:${p.color};"></div><span class="task-group-title">${p.name}</span><span class="badge badge-neutral">${tasks.length} tasks</span></div></div><div class="task-list">`;
      tasks.forEach(task => {
        const isDone = task.status === 'done';
        const assignee = task.assigneeId ? data.team.find(m => m.id === task.assigneeId) : null;
        html += `<div class="task-item ${isDone ? 'completed' : ''}" data-task-id="${task.id}"><div class="task-select-checkbox" style="margin-right:var(--space-2);" title="Select task">
          <input type="checkbox" class="task-select-input" data-task-id="${task.id}" style="display:none;">
          <div class="task-select-box"></div>
        </div><button class="task-checkbox ${isDone ? 'checked' : ''}"></button><div class="task-item-content"><span class="task-item-title">${task.name}</span>${task.priority ? `<span class="badge badge-${task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'success'}" style="margin-left:8px;font-size:10px;padding:2px 8px;">${task.priority}</span>` : ''}${task.description ? `<p class="task-item-desc">${task.description}</p>` : ''}</div><div class="task-item-right">${assignee ? `<div class="avatar avatar-xs" style="background:${assignee.color || 'var(--primary)'};margin-right:8px;" title="${assignee.name}">${getInitials(assignee.name)}</div>` : ''}${task.dueDate ? `<span class="task-item-due ${new Date(task.dueDate) < new Date() && !isDone ? 'overdue' : ''}">${task.dueDate}</span>` : ''}</div></div>`;
      });
      html += '</div></div>';
    }
    html += '</div>';
    container.innerHTML = html;
    initTaskItemListeners();

    document.querySelectorAll('.task-select-checkbox').forEach(box => {
      box.addEventListener('click', (e) => {
        e.stopPropagation();
        const input = box.querySelector('.task-select-input');
        const taskId = input.dataset.taskId;
        if (input.checked) {
          input.checked = false;
          selectedTaskIds = selectedTaskIds.filter(id => id !== taskId);
          box.classList.remove('selected');
        } else {
          input.checked = true;
          selectedTaskIds.push(taskId);
          box.classList.add('selected');
        }
        updateBulkUI();
      });
    });
    document.getElementById('bulk-delete-tasks')?.addEventListener('click', () => {
      if (selectedTaskIds.length === 0) return;
      if (confirm(`Delete ${selectedTaskIds.length} selected task(s)?`)) {
        const data = getData();
        data.tasks = data.tasks.filter(t => !selectedTaskIds.includes(t.id));
        saveData(data);
        showToast(`${selectedTaskIds.length} task(s) deleted`);
        refreshCurrentView();
      }
    });
    document.getElementById('bulk-clear-tasks')?.addEventListener('click', () => {
      selectedTaskIds = [];
      document.querySelectorAll('.task-select-input').forEach(i => i.checked = false);
      document.querySelectorAll('.task-select-checkbox').forEach(b => b.classList.remove('selected'));
      updateBulkUI();
    });
  }

  function renderCalendar() {
    const container = document.getElementById('calendar-content');
    if (!container) return;
    
    let calMonth = parseInt(localStorage.getItem('pm-cal-month') || new Date().getMonth());
    let calYear = parseInt(localStorage.getItem('pm-cal-year') || new Date().getFullYear());
    let calView = localStorage.getItem('pm-cal-view') || 'month';
    if (isNaN(calMonth)) calMonth = new Date().getMonth();
    if (isNaN(calYear)) calYear = new Date().getFullYear();

    function saveCalNav() {
      localStorage.setItem('pm-cal-month', calMonth);
      localStorage.setItem('pm-cal-year', calYear);
      localStorage.setItem('pm-cal-view', calView);
    }

    function render() {
      const today = new Date();
      const data = getData();
      const firstDay = new Date(calYear, calMonth, 1).getDay();
      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

      const tasksByDate = {};
      data.tasks.forEach(t => {
        if (t.dueDate) {
          if (!tasksByDate[t.dueDate]) tasksByDate[t.dueDate] = [];
          tasksByDate[t.dueDate].push(t);
        }
      });

      const eventsByDate = {};
      data.events.forEach(e => {
        if (e.date) {
          if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
          eventsByDate[e.date].push(e);
        }
      });

      let mainHtml = '';

      if (calView === 'week') {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        mainHtml = `<div class="week-calendar"><div class="week-header">${weekdays.map((d, i) => {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          const isToday = today.toDateString() === date.toDateString();
          return `<div class="week-day-header"><span class="week-day-name">${d}</span><span class="week-day-number ${isToday ? 'today' : ''}">${date.getDate()}</span></div>`;
        }).join('')}</div><div class="week-body" id="week-body">${weekdays.map((_, i) => {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          const dayTasks = tasksByDate[dateStr] || [];
          const dayEvents = eventsByDate[dateStr] || [];
          const items = [...dayTasks.map(t => ({ type: 'task', name: t.name, id: t.id })), ...dayEvents.map(e => ({ type: 'event', name: e.name, id: e.id }))];
          return `<div class="week-cell" data-date="${dateStr}">${items.map(it => `<div class="week-event ${it.type === 'task' ? 'emerald' : 'amber'}" data-${it.type}-id="${it.id}" style="top:${items.indexOf(it) * 22 + 2}px;height:18px;font-size:10px;line-height:18px;">${it.name}</div>`).join('')}</div>`;
        }).join('')}</div></div>`;
      } else {
        let gridHtml = '<div class="calendar-grid"><div class="calendar-weekdays">';
        weekdays.forEach(d => { gridHtml += '<span class="calendar-weekday">' + d + '</span>'; });
        gridHtml += '</div><div class="calendar-days">';
        for (let i = 0; i < firstDay; i++) {
          gridHtml += '<div class="calendar-day empty"></div>';
        }
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
          const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;
          const hasTasks = (tasksByDate[dateStr] && tasksByDate[dateStr].length > 0);
          const hasEvents = (eventsByDate[dateStr] && eventsByDate[dateStr].length > 0);
          const tasks = tasksByDate[dateStr] || [];
          const overdue = tasks.some(t => t.status !== 'done' && new Date(t.dueDate) < new Date());
          gridHtml += '<div class="calendar-day' + (isToday ? ' today' : '') + ((hasTasks || hasEvents) ? ' has-tasks' : '') + '" data-date="' + dateStr + '"><span class="calendar-day-number">' + day + '</span>';
          if (hasTasks || hasEvents) {
            gridHtml += '<div class="calendar-day-dots">';
            if (hasTasks) gridHtml += '<span class="calendar-dot' + (overdue ? ' overdue' : '') + '"></span>';
            if (hasEvents) gridHtml += '<span class="calendar-dot" style="background:var(--accent);"></span>';
            gridHtml += '</div>';
          }
          gridHtml += '</div>';
        }
        gridHtml += '</div></div>';
        mainHtml = gridHtml;
      }

      const sortedTasks = data.tasks.filter(t => t.dueDate && t.status !== 'done').sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8);
      let sidebarHtml = '<div class="calendar-sidebar"><div class="widget"><div class="widget-header"><h3 class="widget-title">Upcoming Deadlines</h3></div><div class="deadline-list">';
      if (sortedTasks.length === 0) {
        sidebarHtml += '<p style="font-size:var(--text-sm);color:var(--text-tertiary);padding:var(--space-4) 0;text-align:center;">No upcoming deadlines</p>';
      } else {
        sortedTasks.forEach(t => {
          const project = data.projects.find(p => p.id === t.projectId);
          const due = new Date(t.dueDate);
          const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
          const isOverdue = diffDays < 0;
          const urgency = isOverdue ? 'urgent' : (diffDays <= 2 ? 'soon' : 'normal');
          sidebarHtml += '<div class="deadline-item" data-task-id="' + t.id + '"><div class="deadline-color" style="background:' + (project ? project.color : 'var(--primary)') + '"></div><div class="deadline-info"><div class="deadline-title">' + t.name + '</div><div class="deadline-date">' + t.dueDate + '</div></div><span class="deadline-days ' + urgency + '">' + (isOverdue ? Math.abs(diffDays) + 'd overdue' : (diffDays === 0 ? 'Today' : diffDays + 'd')) + '</span></div>';
        });
      }
      sidebarHtml += '</div></div></div>';

      container.innerHTML = `<div class="calendar-layout"><div class="calendar-main"><div class="calendar-nav">
        <div style="display:flex;align-items:center;gap:var(--space-2);">
          <button class="btn btn-ghost btn-icon" id="cal-prev"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
          <span class="calendar-nav-title">${months[calMonth]} ${calYear}</span>
          <button class="btn btn-ghost btn-icon" id="cal-next"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
        </div>
        <div class="segmented-control">
          <button class="segmented-control-item ${calView === 'month' ? 'active' : ''}" id="cal-view-month">Month</button>
          <button class="segmented-control-item ${calView === 'week' ? 'active' : ''}" id="cal-view-week">Week</button>
        </div>
      </div>${mainHtml}</div>${sidebarHtml}</div>`;

      document.getElementById('cal-prev')?.addEventListener('click', () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } saveCalNav(); render(); });
      document.getElementById('cal-next')?.addEventListener('click', () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } saveCalNav(); render(); });
      document.getElementById('cal-view-month')?.addEventListener('click', () => { calView = 'month'; saveCalNav(); render(); });
      document.getElementById('cal-view-week')?.addEventListener('click', () => { calView = 'week'; saveCalNav(); render(); });

      if (calView === 'week') {
        setTimeout(() => {
          container.querySelectorAll('.week-cell').forEach(cell => {
            cell.addEventListener('click', () => {
              const date = cell.dataset.date;
              const dateTasks = data.tasks.filter(t => t.dueDate === date);
              const dateEvents = data.events.filter(e => e.date === date);
              if (dateTasks.length === 1 && dateEvents.length === 0) openTaskDrawerEdit(dateTasks[0].id);
              else openCalendarDayList(date, dateTasks, dateEvents);
            });
          });
          container.querySelectorAll('.week-event').forEach(ev => {
            ev.addEventListener('click', (e) => {
              e.stopPropagation();
              if (ev.dataset.taskId) openTaskDrawerEdit(ev.dataset.taskId);
            });
          });
        }, 0);
      }

      if (calView === 'month') {
        container.querySelectorAll('.calendar-day:not(.empty)').forEach(day => {
          day.addEventListener('click', () => {
            const date = day.dataset.date;
            const dateTasks = data.tasks.filter(t => t.dueDate === date);
            const dateEvents = data.events.filter(e => e.date === date);
            if (dateTasks.length === 0 && dateEvents.length === 0) return;
            if (dateTasks.length === 1 && dateEvents.length === 0) {
              openTaskDrawerEdit(dateTasks[0].id);
            } else {
              openCalendarDayList(date, dateTasks, dateEvents);
            }
          });
          let dragStartDate = null;
          day.addEventListener('mousedown', (e) => {
            dragStartDate = day.dataset.date;
            const onMouseUp = (ev) => {
              const endDay = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.calendar-day');
              const endDate = endDay?.dataset.date;
              if (endDate && endDate !== dragStartDate) {
                const s = dragStartDate < endDate ? dragStartDate : endDate;
                const e = dragStartDate < endDate ? endDate : dragStartDate;
                openTaskDrawerCreate(getData().projects[0]?.id, 'todo', s, e);
              }
              document.removeEventListener('mouseup', onMouseUp);
            };
            document.addEventListener('mouseup', onMouseUp);
          });
        });
      }

      container.querySelectorAll('.deadline-item').forEach(item => {
        item.addEventListener('click', () => {
          if (item.dataset.taskId) openTaskDrawerEdit(item.dataset.taskId);
        });
      });
    }

    render();
  }

  function openCalendarDayList(date, tasks, events) {
    events = events || [];
    const badges = document.getElementById('drawer-badges');
    const content = document.getElementById('drawer-content');
    if (!content) return;
    badges.innerHTML = '<span class="badge badge-info">' + date + '</span>';
    let html = '<div style="padding:var(--space-2) 0;">';
    html += '<p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-3);">' + tasks.length + ' task(s), ' + events.length + ' event(s)</p>';
    html += '<div style="display:flex;flex-direction:column;gap:var(--space-2);">';
    tasks.forEach(t => {
      html += '<div class="task-item" style="margin:0;" data-task-id="' + t.id + '"><button class="task-checkbox ' + (t.status === 'done' ? 'checked' : '') + '"></button><div class="task-item-content"><span class="task-item-title">' + t.name + '</span></div></div>';
    });
    events.forEach(e => {
      html += '<div class="task-item" style="margin:0;border-left:3px solid var(--accent);"><div class="task-item-content"><span class="task-item-title">' + e.name + '</span><span style="font-size:var(--text-xs);color:var(--text-tertiary);">' + (e.time || '') + '</span></div></div>';
    });
    html += '</div></div><div class="task-drawer-actions"><button class="btn btn-ghost" id="cal-day-close">Close</button></div>';
    content.innerHTML = html;
    openDrawer();
    document.getElementById('cal-day-close')?.addEventListener('click', closeDrawer);
    initTaskItemListeners();
  }

  function renderTeam() {
    const data = getData();
    const container = document.getElementById('team-content');
    const subtitle = document.getElementById('team-subtitle');
    if (!container) return;
    if (subtitle) subtitle.textContent = `${data.team.length} member${data.team.length !== 1 ? 's' : ''}`;
    if (data.team.length === 0) {
      container.innerHTML = renderEmptyState('No team members yet', 'Add team members to collaborate on projects.', 'Add Member', 'empty-add-member');
      document.getElementById('empty-add-member')?.addEventListener('click', () => openTeamDrawerCreate());
      return;
    }
    const roleOrder = ['Owner', 'Admin', 'Member'];
    const grouped = {};
    roleOrder.forEach(r => grouped[r] = []);
    data.team.forEach(m => {
      const role = m.role || 'Member';
      if (grouped[role]) grouped[role].push(m);
      else grouped['Member'].push(m);
    });
    const roleIcons = {
      Owner: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      Admin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z"/></svg>',
      Member: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>'
    };
    let html = '<div class="team-members-list">';
    roleOrder.forEach(role => {
      const members = grouped[role];
      if (!members || members.length === 0) return;
      html += `<div class="team-section-heading"><span class="team-section-icon">${roleIcons[role]}</span>${role}<span class="team-section-count">${members.length}</span></div>`;
      members.forEach(m => {
        const initials = getInitials(m.name);
        const color = m.color || 'var(--primary)';
        const avatarHtml = m.photo
          ? `<div class="team-member-avatar"><div class="avatar" style="width:40px;height:40px;"><img src="${m.photo}" alt="${m.name}" class="team-member-photo"></div></div>`
          : `<div class="team-member-avatar"><div class="avatar" style="background:${color};width:40px;height:40px;font-size:14px;">${initials}</div></div>`;
        html += `<div class="team-member-row" data-member-id="${m.id}">${avatarHtml}<div class="team-member-info"><span class="team-member-name">${m.name} <span class="role-badge role-${role.toLowerCase()}">${role}</span></span></div><div class="team-member-actions"><button class="btn-icon-small edit-member-btn" data-member-id="${m.id}" title="Edit member"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button><button class="btn-icon-small delete-member-btn" data-member-id="${m.id}" title="Remove member" style="color:var(--danger);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div></div>`;
      });
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.edit-member-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openTeamDrawerEdit(btn.dataset.memberId); });
    });
    container.querySelectorAll('.delete-member-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); if (confirm('Remove this team member?')) deleteTeamMember(btn.dataset.memberId); });
    });
  }

  function renderAnalytics() {
    const data = getData();
    const container = document.getElementById('analytics-content');
    if (!container) return;
    const totalTasks = data.tasks.length;
    const completedTasks = data.tasks.filter(t => t.status === 'done').length;
    const rate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const byStatus = { backlog: 0, todo: 0, inprogress: 0, review: 0, done: 0 };
    data.tasks.forEach(t => { if (byStatus[t.status] !== undefined) byStatus[t.status]++; });
    const byProject = {};
    data.tasks.forEach(t => { byProject[t.projectId] = (byProject[t.projectId] || 0) + 1; });

    const statusLabels = { backlog: 'Backlog', todo: 'To Do', inprogress: 'In Progress', review: 'In Review', done: 'Done' };
    const statusColors = { backlog: COLORS[5], todo: COLORS[3], inprogress: COLORS[0], review: COLORS[6], done: COLORS[1] };
    const statuses = ['backlog', 'todo', 'inprogress', 'review', 'done'];

    const size = 160, cx = size/2, cy = size/2, r = 60, strokeW = 16;
    const total = totalTasks || 1;
    let cumulative = 0;
    let donutSlices = '';
    statuses.forEach(s => {
      const val = byStatus[s];
      if (val === 0) return;
      const pct = val / total;
      const startAngle = cumulative * 2 * Math.PI;
      cumulative += pct;
      const endAngle = cumulative * 2 * Math.PI;
      const x1 = cx + r * Math.sin(startAngle);
      const y1 = cy - r * Math.cos(startAngle);
      const x2 = cx + r * Math.sin(endAngle);
      const y2 = cy - r * Math.cos(endAngle);
      const large = pct > 0.5 ? 1 : 0;
      donutSlices += '<path d="M' + cx + ' ' + cy + ' L' + x1 + ' ' + y1 + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2 + ' Z" fill="' + statusColors[s] + '" stroke="var(--bg-elevated)" stroke-width="2"/>';
    });
    const donutCenter = r - strokeW;
    const donutHtml = `<svg viewBox="0 0 ${size} ${size}" style="width:${size}px;height:${size}px;"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--bg-tertiary)" stroke-width="${strokeW}"/>${donutSlices}<circle cx="${cx}" cy="${cy}" r="${donutCenter}" fill="var(--bg-elevated)"/><text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="var(--font-serif)" font-size="28" font-weight="700" fill="var(--text-primary)">${rate}%</text><text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="11" fill="var(--text-secondary)">${completedTasks}/${totalTasks}</text></svg>`;

    let barHtml = '';
    const topProjects = Object.entries(byProject).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxTasks = topProjects[0] ? topProjects[0][1] : 1;
    topProjects.forEach(([pid, count]) => {
      const p = data.projects.find(pr => pr.id === pid);
      if (!p) return;
      barHtml += `<div class="bar-chart-row"><div class="bar-chart-label"><span class="sidebar-dot" style="background:${p.color};"></span>${p.name}</div><div class="bar-chart-bar"><div class="bar-chart-fill" style="width:${(count/maxTasks*100)}%;background:${p.color};"></div></div><div class="bar-chart-value">${count}</div></div>`;
    });

    container.innerHTML = `<div class="stats-row"><div class="stat-card"><div class="stat-card-header"><span class="stat-card-label">Total Tasks</span></div><div class="stat-card-value">${totalTasks}</div></div><div class="stat-card"><div class="stat-card-header"><span class="stat-card-label">Completed</span></div><div class="stat-card-value">${completedTasks}</div></div><div class="stat-card"><div class="stat-card-header"><span class="stat-card-label">Completion Rate</span></div><div class="stat-card-value">${rate}%</div></div><div class="stat-card"><div class="stat-card-header"><span class="stat-card-label">Projects</span></div><div class="stat-card-value">${data.projects.length}</div></div></div><div class="analytics-grid"><div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Task Distribution</div><div class="chart-card-subtitle">Breakdown by status</div></div></div><div class="chart-container-donut">${donutHtml}</div><div class="chart-legend-grid">${statuses.map(s => `<div class="legend-item"><span class="legend-dot" style="background:${statusColors[s]};"></span>${statusLabels[s]} (${byStatus[s]})</div>`).join('')}</div></div><div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Tasks by Project</div><div class="chart-card-subtitle">Top projects</div></div></div>${barHtml || '<p style="font-size:var(--text-sm);color:var(--text-tertiary);text-align:center;padding:var(--space-6);">No tasks yet</p>'}</div></div>`;
  }

  function createProject(name, color) {
    var c = color || COLORS[state.projects.length % COLORS.length];
    API.post('/projects', { name: name, color: c }).then(function (p) {
      state.projects.unshift(p);
      showToast('Project created');
      saveData();
      refreshCurrentView();
    }).catch(function (err) { showToast(err.message || 'Failed to create project', 'error'); });
  }

  function updateProject(projectId, updates) {
    API.patch('/projects/' + projectId, updates).then(function (p) {
      var idx = state.projects.findIndex(function (x) { return x.id === projectId; });
      if (idx !== -1) state.projects[idx] = p;
      showToast('Project updated');
      refreshCurrentView();
    }).catch(function (err) { showToast(err.message || 'Failed to update project', 'error'); });
  }

  function deleteProject(projectId) {
    API.del('/projects/' + projectId).then(function () {
      state.tasks = state.tasks.filter(function (t) { return t.projectId !== projectId; });
      state.projects = state.projects.filter(function (p) { return p.id !== projectId; });
      showToast('Project deleted');
      if (currentProjectId === projectId) { currentProjectId = null; navigateTo('projects'); }
      else refreshCurrentView();
    }).catch(function (err) { showToast(err.message || 'Failed to delete project', 'error'); });
  }

  function createTask(name, projectId, status, dueDate, priority, description, assigneeId, recurrence) {
    API.post('/tasks', {
      project_id: projectId, name: name, status: status || 'todo',
      due_date: dueDate || null, priority: priority || 'medium',
      description: description || '', assignee_id: assigneeId || null,
      recurrence: recurrence || 'none',
    }).then(function (t) {
      state.tasks.unshift(t);
      showToast('Task created');
      saveData();
      refreshCurrentView();
    }).catch(function (err) { showToast(err.message || 'Failed to create task', 'error'); });
  }

  function updateTask(taskId, updates) {
    var mapped = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.description !== undefined) mapped.description = updates.description;
    if (updates.status !== undefined) mapped.status = updates.status;
    if (updates.priority !== undefined) mapped.priority = updates.priority;
    if (updates.dueDate !== undefined) mapped.due_date = updates.dueDate;
    if (updates.assigneeId !== undefined) mapped.assignee_id = updates.assigneeId;
    if (updates.recurrence !== undefined) mapped.recurrence = updates.recurrence;
    if (updates.projectId !== undefined) mapped.project_id = updates.projectId;

    API.patch('/tasks/' + taskId, mapped).then(function (t) {
      var idx = state.tasks.findIndex(function (x) { return x.id === taskId; });
      if (idx !== -1) {
        state.tasks[idx] = t;
        if (updates.subtasks !== undefined) state.tasks[idx].subtasks = updates.subtasks;
        if (updates.comments !== undefined) state.tasks[idx].comments = updates.comments;
      }
      showToast('Task updated');
      refreshCurrentView();
    }).catch(function (err) { showToast(err.message || 'Failed to update task', 'error'); });
  }

  function deleteTask(taskId) {
    var task = state.tasks.find(function (t) { return t.id === taskId; });
    API.del('/tasks/' + taskId).then(function () {
      state.tasks = state.tasks.filter(function (t) { return t.id !== taskId; });
      showToast('Task deleted', 'info');
      refreshCurrentView();
    }).catch(function (err) { showToast(err.message || 'Failed to delete task', 'error'); });
  }

  function createTeamMember(name, role, photo) {
    API.post('/team', { name: name, role: role || 'Member', photo_url: photo || null }).then(function (m) {
      state.team.push(m);
      showToast('Team member added');
      refreshCurrentView();
    }).catch(function (err) { showToast(err.message || 'Failed to add member', 'error'); });
  }

  function updateTeamMember(memberId, updates) {
    var mapped = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.role !== undefined) mapped.role = updates.role;
    if (updates.color !== undefined) mapped.color = updates.color;
    if (updates.photo !== undefined) mapped.photo_url = updates.photo;

    API.patch('/team/' + memberId, mapped).then(function (m) {
      var idx = state.team.findIndex(function (x) { return x.id === memberId; });
      if (idx !== -1) state.team[idx] = m;
      showToast('Team member updated');
      refreshCurrentView();
    }).catch(function (err) { showToast(err.message || 'Failed to update member', 'error'); });
  }

  function deleteTeamMember(memberId) {
    API.del('/team/' + memberId).then(function () {
      state.tasks.forEach(function (t) { if (t.assignee_id === memberId) t.assignee_id = null; });
      state.team = state.team.filter(function (m) { return m.id !== memberId; });
      showToast('Team member removed');
      refreshCurrentView();
    }).catch(function (err) { showToast(err.message || 'Failed to remove member', 'error'); });
  }

  function createEvent(name, date, time) {
    API.post('/events', { name: name, date: date, time: time || '09:00' }).then(function (e) {
      state.events.push(e);
      showToast('Event created');
      refreshCurrentView();
    }).catch(function (err) { showToast(err.message || 'Failed to create event', 'error'); });
  }

  function deleteEvent(eventId) {
    API.del('/events/' + eventId).then(function () {
      state.events = state.events.filter(function (e) { return e.id !== eventId; });
      showToast('Event deleted');
      refreshCurrentView();
    }).catch(function (err) { showToast(err.message || 'Failed to delete event', 'error'); });
  }

  function toggleTaskStatus(taskId) {
    API.patch('/tasks/' + taskId + '/toggle').then(function (res) {
      var task = state.tasks.find(function (t) { return t.id === taskId; });
      if (task) {
        task.status = res.status;
        if (task.status === 'done' && task.project_id) {
          var pt = state.tasks.filter(function (t2) { return t2.project_id === task.project_id; });
          var allDone = pt.length > 0 && pt.every(function (t2) { return t2.status === 'done'; });
          if (allDone) { triggerConfetti(); announceToScreenReader('All tasks in project completed!'); }
        }
      }
      refreshCurrentView();
    }).catch(function (err) { showToast(err.message || 'Failed to toggle task', 'error'); });
  }

  function showPageSkeleton(pageId) {
    var page = document.getElementById('page-' + pageId);
    if (!page) return;
    var contentAreas = { dashboard: 'dashboard-content', projects: 'projects-content', tasks: 'tasks-content', calendar: 'calendar-content', team: 'team-content', analytics: 'analytics-content', settings: null };
    var areaId = contentAreas[pageId];
    if (areaId) {
      var area = document.getElementById(areaId);
      if (area && !area.querySelector('.skeleton')) {
        area.innerHTML = '';
        showSkeleton(area, 4, 'card');
      }
    }
  }

  let currentProjectId = null;
  let pageTransitionActive = false;

  function addRevealClasses(container) {
    var selectors = [
      '.stat-card',
      '.project-card',
      '.project-card-large',
      '.section-header',
      '.kanban-column',
      '.task-group',
      '.task-item',
      '.team-member-row',
      '.widget',
      '.chart-card',
      '.deadline-item',
      '.settings-section'
    ];
    for (var s = 0; s < selectors.length; s++) {
      var els = container.querySelectorAll(selectors[s]);
      for (var e = 0; e < els.length; e++) {
        els[e].classList.add('reveal');
        els[e].style.setProperty('--reveal-index', e);
      }
    }
  }

  function switchPage(pageId) {
    switch (pageId) {
      case 'dashboard': renderDashboard(); break;
      case 'projects': renderProjects(); break;
      case 'project-detail': renderProjectDetail(currentProjectId); break;
      case 'tasks': renderTasks(); break;
      case 'calendar': renderCalendar(); break;
      case 'team': renderTeam(); break;
      case 'analytics': renderAnalytics(); break;
    }
  }

  function flashLoadingBar() {
    var bar = document.getElementById('loading-bar');
    if (!bar) return;
    bar.classList.remove('active', 'finishing');
    bar.style.width = '0';
    bar.style.opacity = '1';
    requestAnimationFrame(function () {
      bar.style.width = '40%';
      bar.classList.add('active');
      setTimeout(function () {
        bar.style.width = '85%';
      }, 200);
    });
  }

    function navigateTo(pageId, projectId) {
      if (pageTransitionActive) return;
      pageTransitionActive = true;
      if (projectId) currentProjectId = projectId;

      flashLoadingBar();

    document.querySelectorAll('.sidebar-item').forEach(function (i) { i.classList.remove('active'); });
    var sidebarTarget = document.querySelector('.sidebar-item[data-page="' + pageId + '"]');
    if (sidebarTarget) sidebarTarget.classList.add('active');
    document.querySelectorAll('.nav-item-mobile').forEach(function (i) { i.classList.remove('active'); });
    var mobileTarget = document.querySelector('.nav-item-mobile[data-page="' + pageId + '"]');
    if (mobileTarget) mobileTarget.classList.add('active');

    updateBreadcrumbs(pageId);
    localStorage.setItem('pm-last-page', pageId);
    if (pageId === 'project-detail' && projectId) localStorage.setItem('pm-last-project', projectId);
    else localStorage.removeItem('pm-last-project');

    var oldPage = document.querySelector('.page.active');
    var newPage = document.getElementById('page-' + pageId);

    function finishTransition() {
      if (!pageTransitionActive) return;
      if (newPage) newPage.classList.remove('entering');
      pageTransitionActive = false;
      if (newPage) triggerReveals(newPage, 50);
      document.querySelector('.page-content').scrollTo({ top: 0, behavior: 'instant' });
    }

    if (oldPage && newPage && oldPage !== newPage) {
      oldPage.classList.add('exiting');

      newPage.classList.add('active');
      switchPage(pageId);
      addRevealClasses(newPage);
      newPage.classList.add('entering');

      clearPageTimer = setTimeout(function () {
        oldPage.classList.remove('active', 'exiting');
        finishTransition();
      }, 420);
    } else if (newPage) {
      newPage.classList.add('active');
      switchPage(pageId);
      addRevealClasses(newPage);
      newPage.classList.add('entering');
      setTimeout(finishTransition, 450);
    } else {
      pageTransitionActive = false;
    }
  }

  var clearPageTimer = null;

  function refreshCurrentView() {
  const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    const pageId = activePage.id.replace('page-', '');
    if (pageId === 'project-detail') renderProjectDetail(currentProjectId);
    else switchPage(pageId);
    updateProjectCount();
    updateCommandPaletteProjects();
    updateNotificationBadge();
  }

  function updateBreadcrumbs(pageId) {
    const bc = document.querySelector('.top-nav-breadcrumbs');
    if (!bc) return;
    let name = pageId.charAt(0).toUpperCase() + pageId.slice(1);
    if (pageId === 'project-detail' && currentProjectId) {
      const data = getData();
      const p = data.projects.find(p => p.id === currentProjectId);
      if (p) name = p.name;
    }
    bc.innerHTML = `<span class="breadcrumb-item">Workspace</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg><span class="breadcrumb-item active">${name}</span>`;
  }

  function initNavigation() {
    document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
      item.addEventListener('click', () => {
        const p = item.dataset.page;
        navigateTo(p === 'project-detail' ? 'projects' : p);
      });
    });
    document.querySelectorAll('.nav-item-mobile[data-page]').forEach(item => {
      item.addEventListener('click', () => navigateTo(item.dataset.page));
    });
  }

  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebar-toggle');
    const menuBtn = document.getElementById('menu-toggle');

    const toggleDesktop = () => {
      sidebar?.classList.toggle('collapsed');
      localStorage.setItem('sidebar-collapsed', sidebar?.classList.contains('collapsed') ? 'true' : 'false');
    };

    const toggleMobile = () => {
      sidebar?.classList.toggle('mobile-open');
      document.body.classList.toggle('sidebar-open');
    };

    toggle?.addEventListener('click', toggleDesktop);
    menuBtn?.addEventListener('click', () => {
      if (window.innerWidth > 768) toggleDesktop();
      else toggleMobile();
    });

    if (localStorage.getItem('sidebar-collapsed') === 'true') sidebar?.classList.add('collapsed');

    document.addEventListener('click', (e) => {
      if (sidebar?.classList.contains('mobile-open') && !sidebar.contains(e.target) && !menuBtn?.contains(e.target)) {
        sidebar.classList.remove('mobile-open');
        document.body.classList.remove('sidebar-open');
      }
    });
  }

  function initDarkMode() {
    const themeToggle = document.getElementById('theme-toggle');
    const settingsToggle = document.getElementById('dark-mode-toggle');
    function setTheme(dark) {
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      localStorage.setItem('theme', dark ? 'dark' : 'light');
      if (settingsToggle) settingsToggle.classList.toggle('active', dark);
    }
    const saved = localStorage.getItem('theme');
    setTheme(saved === 'dark' || !saved);
    themeToggle?.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      
      // Animation
      themeToggle.style.transform = 'scale(0.8) rotate(-45deg)';
      setTimeout(() => {
        setTheme(!isDark);
        themeToggle.style.transform = 'scale(1.1) rotate(0deg)';
        setTimeout(() => {
          themeToggle.style.transform = '';
        }, 200);
      }, 100);
    });
    settingsToggle?.addEventListener('click', () => {
      settingsToggle.classList.toggle('active');
      setTheme(settingsToggle.classList.contains('active'));
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) setTheme(e.matches);
    });
  }

  function initCommandPalette() {
    const overlay = document.getElementById('command-palette');
    const trigger = document.getElementById('cmdk-trigger');
    const backdrop = overlay?.querySelector('.command-palette-backdrop');
    const input = overlay?.querySelector('.command-palette-input');
    let focusedIndex = 0;
    function openCmdk() { overlay?.classList.add('active'); overlay.style.display = 'flex'; focusedIndex = 0; setTimeout(() => input?.focus(), 50); }
    function animateClose(el, callback) {
      if (!el) return;
      el.classList.add('exiting');
      const onEnd = () => {
        el.classList.remove('exiting');
        if (callback) callback();
        el.removeEventListener('animationend', onEnd);
      };
      el.addEventListener('animationend', onEnd);
      // Fallback
      setTimeout(onEnd, 500);
    }

    function closeCmdk() { 
      var overlay = document.getElementById('command-palette');
      if (!overlay) return;
      var cmdk = overlay.querySelector('.command-palette');
      if (cmdk) {
        animateClose(cmdk, () => {
          overlay.classList.remove('active');
          overlay.style.display = 'none';
          var input = overlay.querySelector('.command-palette-input');
          if (input) input.value = '';
        });
      } else {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
      }
    }
    trigger?.addEventListener('click', openCmdk);
    backdrop?.addEventListener('click', closeCmdk);
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); overlay?.classList.contains('active') ? closeCmdk() : openCmdk(); }
      if (e.key === 'Escape') { closeCmdk(); closeDrawer(); }
    });
    input?.addEventListener('keydown', (e) => {
      const items = overlay?.querySelectorAll('.command-item');
      if (!items?.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); items.forEach(i => i.classList.remove('focused')); focusedIndex = Math.min(focusedIndex + 1, items.length - 1); items[focusedIndex]?.classList.add('focused'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items.forEach(i => i.classList.remove('focused')); focusedIndex = Math.max(focusedIndex - 1, 0); items[focusedIndex]?.classList.add('focused'); }
      else if (e.key === 'Enter') { e.preventDefault(); items[focusedIndex]?.click(); }
    });
    var cmdQueue = null;
    input?.addEventListener('input', function(e) {
      var q = e.target.value.toLowerCase();
      if (cmdQueue) cancelAnimationFrame(cmdQueue);
      cmdQueue = requestAnimationFrame(function() {
        cmdQueue = null;
        var items = overlay.querySelectorAll('.command-item');
        var visibleCount = 0;
        for (var i = 0; i < items.length; i++) {
          var text = items[i].querySelector('span')?.textContent.toLowerCase() || '';
          var isVisible = text.includes(q);
          items[i].style.display = isVisible ? '' : 'none';
          if (isVisible) {
            items[i].style.animation = 'none';
            items[i].offsetHeight;
            items[i].style.animation = 'revealIn 0.3s var(--ease-out) both';
            items[i].style.animationDelay = (visibleCount * 30) + 'ms';
            visibleCount++;
          }
        }
      });
    });

    overlay?.addEventListener('click', (e) => {
      const item = e.target.closest('.command-item');
      if (!item) return;
      const action = item.dataset.action;
      const projectId = item.dataset.projectId;
      closeCmdk();
      if (projectId) {
        navigateTo('project-detail', projectId);
      } else if (action === 'create-task') {
        const data = getData();
        if (data.projects.length > 0) openTaskDrawerCreate(data.projects[0].id);
        else { showToast('Create a project first'); navigateTo('projects'); }
      } else if (action === 'create-project') {
        openProjectDrawerCreate();
      } else if (action === 'create-event') {
        openEventDrawerCreate();
      } else if (action === 'nav-dashboard') {
        navigateTo('dashboard');
      } else if (action === 'nav-projects') {
        navigateTo('projects');
      } else if (action === 'nav-calendar') {
        navigateTo('calendar');
      } else if (action === 'nav-tasks') {
        navigateTo('tasks');
      } else if (action === 'nav-team') {
        navigateTo('team');
      } else if (action === 'nav-analytics') {
        navigateTo('analytics');
      } else if (action === 'nav-settings') {
        navigateTo('settings');
      }
    });
  }

  // --- Drawer (shared slide-out panel) ---
  function closeDrawer() {
    const overlay = document.getElementById('task-drawer-overlay');
    const drawer = document.getElementById('task-drawer');
    if (!drawer) return;
    drawer.classList.add('exiting');
    const onEnd = () => {
      drawer.classList.remove('active', 'exiting');
      overlay?.classList.remove('active');
      drawer.removeEventListener('animationend', onEnd);
    };
    drawer.addEventListener('animationend', onEnd);
    setTimeout(onEnd, 500);
  }

  function openDrawer() {
    const overlay = document.getElementById('task-drawer-overlay');
    const drawer = document.getElementById('task-drawer');
    overlay?.classList.add('active');
    drawer?.classList.add('active');
    setTimeout(() => trapFocus(drawer), 100);
  }

  // --- Custom Dropdown ---
  function buildDropdown(options, selectedValue, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-dropdown';

    const trigger = document.createElement('div');
    trigger.className = 'dropdown-trigger';

    const selected = options.find(o => o.value === selectedValue) || options[0];
    trigger.innerHTML = `<span class="dropdown-text">${selected.html || selected.label}</span><svg class="dropdown-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.style.display = 'none';

    let isOpen = false;
    let currentValue = selectedValue;

    options.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'dropdown-item' + (opt.value === currentValue ? ' selected' : '');
      item.innerHTML = opt.html || opt.label;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        currentValue = opt.value;
        trigger.querySelector('.dropdown-text').innerHTML = opt.html || opt.label;
        menu.querySelectorAll('.dropdown-item').forEach(d => d.classList.remove('selected'));
        item.classList.add('selected');
        close();
        onChange(opt.value);
      });
      menu.appendChild(item);
    });

    function open() {
      closeAllDropdowns();
      menu.style.display = 'block';
      wrapper.classList.add('open');
      isOpen = true;
      
      // Ensure menu is within viewport
      const rect = menu.getBoundingClientRect();
      if (rect.bottom > window.innerHeight) {
        menu.style.top = 'auto';
        menu.style.bottom = 'calc(100% + 4px)';
      }
    }

    function close() {
      menu.style.display = 'none';
      wrapper.classList.remove('open');
      isOpen = false;
      menu.style.top = '';
      menu.style.bottom = '';
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen ? close() : open();
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);

    return { 
      element: wrapper, 
      setValue: (val) => {
        currentValue = val;
        const opt = options.find(o => o.value === val);
        if (opt) {
          trigger.querySelector('.dropdown-text').innerHTML = opt.html || opt.label;
          menu.querySelectorAll('.dropdown-item').forEach(d => {
            const itemText = d.textContent.trim();
            d.classList.toggle('selected', itemText === (opt.label || '').trim());
          });
        }
      }
    };
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.custom-dropdown .dropdown-menu').forEach(m => m.style.display = 'none');
    document.querySelectorAll('.custom-dropdown.open').forEach(d => d.classList.remove('open'));
  }

  // --- Task Drawer ---
  function openTaskDrawerCreate(projectId, initialStatus, startDate, endDate) {
    const data = getData();
    if (data.projects.length === 0) { showToast('Create a project first'); return; }

    const project = projectId ? data.projects.find(p => p.id === projectId) : null;
    const projects = data.projects;
    const status = initialStatus || 'todo';

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDue = startDate || tomorrow.toISOString().split('T')[0];

    const badges = document.getElementById('drawer-badges');
    const content = document.getElementById('drawer-content');
    if (!content) return;

    badges.innerHTML = project ? `<span class="badge" style="background:${project.color};color:white;">${project.name}</span>` : '';

    content.innerHTML = `
      <div class="task-drawer-title-area">
        <input type="text" class="task-drawer-title" id="new-task-title" placeholder="Task name" autocomplete="off" autocorrect="off" spellcheck="false">
      </div>
      <div class="task-drawer-section">
        <textarea class="task-drawer-description" id="new-task-desc" placeholder="Add a description..." autocomplete="off" autocorrect="off" spellcheck="false"></textarea>
      </div>
      <div class="task-drawer-meta">
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Due Date
          </span>
          <input type="date" class="task-drawer-meta-value" id="new-task-due" value="${defaultDue}" style="border:none;background:transparent;font:inherit;color:inherit;width:auto;">
        </div>
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            Project
          </span>
          <div id="task-project-dropdown"></div>
        </div>
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            Priority
          </span>
          <div id="task-priority-dropdown"></div>
        </div>
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Assignee
          </span>
          <div id="task-assignee-dropdown"></div>
        </div>
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            Recurrence
          </span>
          <div id="task-recur-dropdown"></div>
        </div>
      </div>
      <div class="task-drawer-actions">
        <button class="btn btn-ghost" id="create-task-cancel">Cancel</button>
        <button class="btn btn-primary" id="create-task-submit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Create Task
        </button>
      </div>`;

    openDrawer();

    let selectedProjectId = projectId || (projects.length > 0 ? projects[0].id : '');
    let selectedPriority = 'medium';

    const projectOpts = projects.map(p => ({
      value: p.id,
      html: `<span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:12px;height:12px;border-radius:50%;background:${p.color};display:inline-block;"></span>${p.name}</span>`
    }));
    const projectDrop = buildDropdown(projectOpts, selectedProjectId, (v) => { selectedProjectId = v; });
    document.getElementById('task-project-dropdown').appendChild(projectDrop.element);

    const priorityOpts = ['low', 'medium', 'high'].map(p => ({
      value: p,
      html: `<span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:8px;height:8px;border-radius:50%;background:${PRIORITY_COLORS[p]};display:inline-block;"></span>${p.charAt(0).toUpperCase() + p.slice(1)}</span>`
    }));
    const priorityDrop = buildDropdown(priorityOpts, selectedPriority, (v) => { selectedPriority = v; });
    document.getElementById('task-priority-dropdown').appendChild(priorityDrop.element);

    let selectedAssignee = null;
    const assigneeOpts = [{ value: '', html: '<span style="color:var(--text-tertiary);">Unassigned</span>' }].concat(data.team.map(m => ({
      value: m.id,
      html: `<span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:24px;height:24px;border-radius:50%;background:${m.color || 'var(--primary)'};display:inline-flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:600;overflow:hidden;">${m.photo ? `<img src="${m.photo}" alt="" style="width:100%;height:100%;object-fit:cover;">` : getInitials(m.name)}</span>${m.name}</span>`
    })));
    const assigneeDrop = buildDropdown(assigneeOpts, '', (v) => { selectedAssignee = v || null; });
    document.getElementById('task-assignee-dropdown').appendChild(assigneeDrop.element);

    let selectedRecur = 'none';
    const recurOpts = [
      { value: 'none', label: 'None' },
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' }
    ].map(r => ({ value: r.value, html: `<span>${r.label}</span>` }));
    const recurDrop = buildDropdown(recurOpts, selectedRecur, (v) => { selectedRecur = v; });
    document.getElementById('task-recur-dropdown').appendChild(recurDrop.element);

    setTimeout(() => document.getElementById('new-task-title')?.focus(), 100);

    document.getElementById('create-task-cancel')?.addEventListener('click', closeDrawer);
    document.getElementById('create-task-submit')?.addEventListener('click', () => {
      const title = document.getElementById('new-task-title')?.value?.trim();
      const description = document.getElementById('new-task-desc')?.value?.trim();
      const dueDate = document.getElementById('new-task-due')?.value;
      if (!title) { showToast('Please enter a task name', 'warning'); return; }
      createTask(title, selectedProjectId, status, dueDate, selectedPriority, description, selectedAssignee, selectedRecur);
      closeDrawer();
    });
    document.getElementById('new-task-title')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('create-task-submit')?.click();
    });
  }

  function openTaskDrawerEdit(taskId) {
    const data = getData();
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return;

    const project = data.projects.find(p => p.id === task.projectId);
    const projects = data.projects;

    const badges = document.getElementById('drawer-badges');
    const content = document.getElementById('drawer-content');
    if (!content) return;

    badges.innerHTML = project ? `<span class="badge" style="background:${project.color};color:white;">${project.name}</span>` : '';

    content.innerHTML = `
      <div class="task-drawer-title-area">
        <input type="text" class="task-drawer-title" id="edit-task-title" value="${task.name}" placeholder="Task name" autocomplete="off" autocorrect="off" spellcheck="false">
      </div>
       <div class="task-drawer-section">
         <div class="task-drawer-section-header">
           <span class="task-drawer-section-title">Subtasks</span>
           <button class="btn btn-sm btn-ghost" id="add-subtask-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Add</button>
         </div>
         <div class="subtask-list" id="subtask-list"></div>
       </div>
       <div class="task-drawer-section">
         <div class="task-drawer-section-header">
           <span class="task-drawer-section-title">Comments</span>
         </div>
         <div class="comment-list" id="comment-list"></div>
         <div class="comment-input-area">
           <input type="text" class="comment-input" id="comment-input" placeholder="Write a comment..." autocomplete="off">
           <button class="btn btn-sm btn-primary" id="add-comment-btn">Post</button>
         </div>
       </div>
      <div class="task-drawer-meta">
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Due Date
          </span>
          <input type="date" class="task-drawer-meta-value" id="edit-task-due" value="${task.dueDate || ''}" style="border:none;background:transparent;font:inherit;color:inherit;width:auto;">
        </div>
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            Project
          </span>
          <div id="edit-task-project-dropdown"></div>
        </div>
        <div class="task-drawer-meta-row">
           <span class="task-drawer-meta-label">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
             Priority
           </span>
           <div id="edit-task-priority-dropdown"></div>
         </div>
         <div class="task-drawer-meta-row">
           <span class="task-drawer-meta-label">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
             Status
           </span>
           <div id="edit-task-status-dropdown"></div>
         </div>
         <div class="task-drawer-meta-row">
           <span class="task-drawer-meta-label">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
             Assignee
           </span>
           <div id="edit-task-assignee-dropdown"></div>
         </div>
         <div class="task-drawer-meta-row">
           <span class="task-drawer-meta-label">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
             Recurrence
           </span>
           <div id="edit-task-recur-dropdown"></div>
         </div>
       </div>
      <div class="task-drawer-actions">
         <button class="btn btn-ghost" id="edit-task-delete" style="color:var(--danger);">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
           Delete
         </button>
        <button class="btn btn-ghost" id="edit-task-cancel">Cancel</button>
        <button class="btn btn-primary" id="edit-task-submit">Save Changes</button>
      </div>`;

    openDrawer();

    let selectedProjectId = task.projectId;
     let selectedPriority = task.priority || 'medium';
     let selectedStatus = task.status || 'todo';

     const projectOpts = projects.map(p => ({
       value: p.id,
       html: `<span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:12px;height:12px;border-radius:50%;background:${p.color};display:inline-block;"></span>${p.name}</span>`
     }));
     const projectDrop = buildDropdown(projectOpts, selectedProjectId, (v) => { selectedProjectId = v; });
     document.getElementById('edit-task-project-dropdown').appendChild(projectDrop.element);

     const priorityOpts = ['low', 'medium', 'high'].map(p => ({
       value: p,
       html: `<span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:8px;height:8px;border-radius:50%;background:${PRIORITY_COLORS[p]};display:inline-block;"></span>${p.charAt(0).toUpperCase() + p.slice(1)}</span>`
     }));
     const priorityDrop = buildDropdown(priorityOpts, selectedPriority, (v) => { selectedPriority = v; });
     document.getElementById('edit-task-priority-dropdown').appendChild(priorityDrop.element);

     const statusOpts = [
       { value: 'backlog', label: 'Backlog' },
       { value: 'todo', label: 'To Do' },
       { value: 'inprogress', label: 'In Progress' },
       { value: 'review', label: 'In Review' },
       { value: 'done', label: 'Done' }
     ].map(s => ({
       value: s.value,
       html: `<span>${s.label}</span>`
     }));
     const statusDrop = buildDropdown(statusOpts, selectedStatus, (v) => { selectedStatus = v; });
     document.getElementById('edit-task-status-dropdown').appendChild(statusDrop.element);

     let selectedAssignee = task.assigneeId || null;
     const assigneeOpts = [{ value: '', html: '<span style="color:var(--text-tertiary);">Unassigned</span>' }].concat(data.team.map(m => ({
       value: m.id,
        html: `<span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:24px;height:24px;border-radius:50%;background:${m.color || 'var(--primary)'};display:inline-flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:600;overflow:hidden;">${m.photo ? `<img src="${m.photo}" alt="" style="width:100%;height:100%;object-fit:cover;">` : getInitials(m.name)}</span>${m.name}</span>`
      })));
      const assigneeDrop = buildDropdown(assigneeOpts, selectedAssignee || '', (v) => { selectedAssignee = v || null; });
      document.getElementById('edit-task-assignee-dropdown').appendChild(assigneeDrop.element);

      let selectedRecur = task.recurrence || 'none';
     const recurOpts = [
       { value: 'none', label: 'None' },
       { value: 'daily', label: 'Daily' },
       { value: 'weekly', label: 'Weekly' },
       { value: 'monthly', label: 'Monthly' }
     ].map(r => ({ value: r.value, html: `<span>${r.label}</span>` }));
     const recurDrop = buildDropdown(recurOpts, selectedRecur, (v) => { selectedRecur = v; });
     document.getElementById('edit-task-recur-dropdown').appendChild(recurDrop.element);

    document.getElementById('edit-task-cancel')?.addEventListener('click', closeDrawer);
    document.getElementById('edit-task-delete')?.addEventListener('click', () => {
      deleteTask(taskId);
      closeDrawer();
    });
    document.getElementById('edit-task-submit')?.addEventListener('click', () => {
      const title = document.getElementById('edit-task-title')?.value?.trim();
      const description = document.getElementById('edit-task-desc')?.value?.trim();
      const dueDate = document.getElementById('edit-task-due')?.value;
      if (!title) { showToast('Please enter a task name', 'warning'); return; }
      updateTask(taskId, { name: title, description, projectId: selectedProjectId, dueDate, priority: selectedPriority, status: selectedStatus, assigneeId: selectedAssignee, recurrence: selectedRecur, subtasks, comments });
      closeDrawer();
    });

    let subtasks = task.subtasks || [];
    let comments = task.comments || [];

    function renderSubtasks() {
      const list = document.getElementById('subtask-list');
      if (!list) return;
      if (subtasks.length === 0) {
        list.innerHTML = '<div style="padding:var(--space-2) 0;font-size:var(--text-sm);color:var(--text-tertiary);">No subtasks yet</div>';
        return;
      }
      list.innerHTML = subtasks.map((st, i) => `
        <div class="subtask-item">
          <button class="subtask-checkbox ${st.done ? 'checked' : ''}" data-index="${i}"></button>
          <span class="subtask-title ${st.done ? 'completed' : ''}">${st.text}</span>
          <button class="btn-icon-small" data-remove-subtask="${i}" style="margin-left:auto;color:var(--text-tertiary);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>
      `).join('');
      list.querySelectorAll('.subtask-checkbox').forEach(cb => {
        cb.addEventListener('click', () => {
          const idx = parseInt(cb.dataset.index);
          subtasks[idx].done = !subtasks[idx].done;
          renderSubtasks();
        });
      });
      list.querySelectorAll('[data-remove-subtask]').forEach(btn => {
        btn.addEventListener('click', () => {
          subtasks.splice(parseInt(btn.dataset.removeSubtask), 1);
          renderSubtasks();
        });
      });
    }

    function renderComments() {
      const list = document.getElementById('comment-list');
      if (!list) return;
      if (comments.length === 0) {
        list.innerHTML = '<div style="padding:var(--space-2) 0;font-size:var(--text-sm);color:var(--text-tertiary);">No comments yet</div>';
        return;
      }
      const data = getData();
      list.innerHTML = comments.map(c => `
        <div class="comment-item">
          <div class="avatar" style="width:28px;height:28px;font-size:10px;margin-top:2px;">${getInitials(data.user?.name || 'U')}</div>
          <div class="comment-body">
            <div class="comment-header"><span class="comment-author">${data.user?.name || 'You'}</span><span class="comment-time">${new Date(c.time).toLocaleDateString()}</span></div>
            <div class="comment-text">${c.text}</div>
          </div>
        </div>
      `).join('');
    }

    renderSubtasks();
    renderComments();

    document.getElementById('add-subtask-btn')?.addEventListener('click', () => {
      const text = prompt('Enter subtask name:');
      if (text && text.trim()) {
        subtasks.push({ text: text.trim(), done: false });
        renderSubtasks();
      }
    });

    document.getElementById('add-comment-btn')?.addEventListener('click', () => {
      const input = document.getElementById('comment-input');
      const text = input?.value?.trim();
      if (text) {
        comments.push({ text, time: new Date().toISOString(), author: 'user' });
        input.value = '';
        renderComments();
      }
    });
    document.getElementById('comment-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('add-comment-btn')?.click();
    });
  }

  // --- Project Drawer ---
  function openProjectDrawerCreate() {
    const content = document.getElementById('drawer-content');
    const badges = document.getElementById('drawer-badges');
    if (!content) return;

    badges.innerHTML = '';
    content.innerHTML = `
      <div class="task-drawer-title-area">
        <input type="text" class="task-drawer-title" id="new-project-title" placeholder="Project name" autocomplete="off" autocorrect="off" spellcheck="false">
      </div>
      <div class="task-drawer-meta">
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            Color
          </span>
          <div class="project-color-options">
            ${COLORS.map((c, i) => `<button type="button" class="project-color-option ${i === 0 ? 'active' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
          </div>
        </div>
      </div>
      <div class="task-drawer-actions">
        <button class="btn btn-ghost" id="create-project-cancel">Cancel</button>
        <button class="btn btn-primary" id="create-project-submit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Create Project
        </button>
      </div>`;

    openDrawer();

    let selectedColor = COLORS[0];
    document.querySelectorAll('.project-color-option').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.project-color-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedColor = COLORS[i];
      });
    });

    setTimeout(() => document.getElementById('new-project-title')?.focus(), 100);
    document.getElementById('create-project-cancel')?.addEventListener('click', closeDrawer);
    document.getElementById('create-project-submit')?.addEventListener('click', () => {
      const title = document.getElementById('new-project-title')?.value?.trim();
      if (!title) { showToast('Please enter a project name', 'warning'); return; }
      createProject(title, selectedColor);
      closeDrawer();
    });
    document.getElementById('new-project-title')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('create-project-submit')?.click();
    });
  }

  function openProjectDrawerEdit(projectId) {
    const data = getData();
    const project = data.projects.find(p => p.id === projectId);
    if (!project) return;
    const content = document.getElementById('drawer-content');
    const badges = document.getElementById('drawer-badges');
    if (!content) return;
    badges.innerHTML = '';
    const currentColorIdx = COLORS.indexOf(project.color);
    content.innerHTML = `
      <div class="task-drawer-title-area">
        <input type="text" class="task-drawer-title" id="edit-project-title" value="${project.name}" placeholder="Project name" autocomplete="off" autocorrect="off" spellcheck="false">
      </div>
      <div class="task-drawer-meta">
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            Color
          </span>
          <div class="project-color-options">
            ${COLORS.map((c, i) => `<button type="button" class="project-color-option ${i === currentColorIdx ? 'active' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
          </div>
        </div>
      </div>
      <div class="task-drawer-actions">
        <button class="btn btn-ghost" id="edit-project-cancel">Cancel</button>
        <button class="btn btn-primary" id="edit-project-submit">Save Changes</button>
      </div>`;
    openDrawer();
    let selectedColor = project.color;
    document.querySelectorAll('.project-color-option').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.project-color-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedColor = COLORS[i];
      });
    });
    setTimeout(() => document.getElementById('edit-project-title')?.focus(), 100);
    document.getElementById('edit-project-cancel')?.addEventListener('click', closeDrawer);
    document.getElementById('edit-project-submit')?.addEventListener('click', () => {
      const title = document.getElementById('edit-project-title')?.value?.trim();
      if (!title) { showToast('Please enter a project name', 'warning'); return; }
      updateProject(projectId, { name: title, color: selectedColor });
      closeDrawer();
    });
  }

  // --- Event Drawer ---
  function openEventDrawerCreate() {
    const content = document.getElementById('drawer-content');
    const badges = document.getElementById('drawer-badges');
    if (!content) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = tomorrow.toISOString().split('T')[0];

    badges.innerHTML = '<span class="badge badge-info">Calendar</span>';
    content.innerHTML = `
      <div class="task-drawer-title-area">
        <input type="text" class="task-drawer-title" id="new-event-title" placeholder="Event name" autocomplete="off" autocorrect="off" spellcheck="false">
      </div>
      <div class="task-drawer-meta">
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Date
          </span>
          <input type="date" class="task-drawer-meta-value" id="new-event-date" value="${defaultDate}" style="border:none;background:transparent;font:inherit;color:inherit;width:auto;">
        </div>
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            Time
          </span>
          <input type="time" class="task-drawer-meta-value" id="new-event-time" value="09:00" style="border:none;background:transparent;font:inherit;color:inherit;width:auto;">
        </div>
      </div>
      <div class="task-drawer-actions">
        <button class="btn btn-ghost" id="create-event-cancel">Cancel</button>
        <button class="btn btn-primary" id="create-event-submit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Create Event
        </button>
      </div>`;

    openDrawer();
    setTimeout(() => document.getElementById('new-event-title')?.focus(), 100);
    document.getElementById('create-event-cancel')?.addEventListener('click', closeDrawer);
    document.getElementById('create-event-submit')?.addEventListener('click', () => {
      const title = document.getElementById('new-event-title')?.value?.trim();
      const date = document.getElementById('new-event-date')?.value;
      const time = document.getElementById('new-event-time')?.value;
      if (!title) { showToast('Please enter an event name', 'warning'); return; }
      createEvent(title, date, time);
      closeDrawer();
    });
    document.getElementById('new-event-title')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('create-event-submit')?.click();
    });
  }

  // --- Team Drawer ---
  function openTeamDrawerCreate() {
    const content = document.getElementById('drawer-content');
    const badges = document.getElementById('drawer-badges');
    if (!content) return;

    badges.innerHTML = '<span class="badge badge-info">Team</span>';
    content.innerHTML = `
      <div class="task-drawer-title-area">
        <input type="text" class="task-drawer-title" id="new-member-name" placeholder="Member name" autocomplete="off" autocorrect="off" spellcheck="false">
      </div>
      <div class="task-drawer-meta">
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Photo
          </span>
          <div class="team-photo-upload">
            <div class="team-photo-preview" id="create-member-photo-preview">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            </div>
            <input type="file" accept="image/*" id="create-member-photo-input" hidden>
            <button class="btn btn-ghost" id="create-member-photo-btn">Upload Photo</button>
            <button class="btn btn-ghost" id="create-member-photo-remove" style="display:none;color:var(--danger);">Remove</button>
          </div>
        </div>
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            Role
          </span>
          <div id="member-role-dropdown"></div>
        </div>
      </div>
      <div class="task-drawer-actions">
        <button class="btn btn-ghost" id="create-member-cancel">Cancel</button>
        <button class="btn btn-primary" id="create-member-submit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
          Add Member
        </button>
      </div>`;

    openDrawer();

    let selectedRole = 'Member';
    let selectedPhoto = null;
    const roleOpts = ['Member', 'Admin', 'Owner'].map(r => ({ value: r, label: r }));
    const roleDrop = buildDropdown(roleOpts, selectedRole, (v) => { selectedRole = v; });
    document.getElementById('member-role-dropdown').appendChild(roleDrop.element);

    const photoInput = document.getElementById('create-member-photo-input');
    const photoPreview = document.getElementById('create-member-photo-preview');
    const photoBtn = document.getElementById('create-member-photo-btn');
    const photoRemove = document.getElementById('create-member-photo-remove');
    photoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', () => {
      const file = photoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        selectedPhoto = e.target.result;
        photoPreview.innerHTML = `<img src="${selectedPhoto}" alt="Preview">`;
        photoBtn.textContent = 'Change Photo';
        photoRemove.style.display = '';
      };
      reader.readAsDataURL(file);
    });
    photoRemove.addEventListener('click', () => {
      selectedPhoto = null;
      photoInput.value = '';
      photoPreview.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
      photoBtn.textContent = 'Upload Photo';
      photoRemove.style.display = 'none';
    });

    setTimeout(() => document.getElementById('new-member-name')?.focus(), 100);
    document.getElementById('create-member-cancel')?.addEventListener('click', closeDrawer);
    document.getElementById('create-member-submit')?.addEventListener('click', () => {
      const name = document.getElementById('new-member-name')?.value?.trim();
      if (!name) { showToast('Please enter a member name', 'warning'); return; }
      createTeamMember(name, selectedRole, selectedPhoto);
      closeDrawer();
    });
    document.getElementById('new-member-name')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('create-member-submit')?.click();
    });
  }

  function openTeamDrawerEdit(memberId) {
    const data = getData();
    const member = data.team.find(m => m.id === memberId);
    if (!member) return;
    const content = document.getElementById('drawer-content');
    const badges = document.getElementById('drawer-badges');
    if (!content) return;
    badges.innerHTML = '<span class="badge badge-info">Edit Member</span>';
    const existingPhoto = member.photo || null;
    content.innerHTML = `
      <div class="task-drawer-title-area">
        <input type="text" class="task-drawer-title" id="edit-member-name" value="${member.name}" placeholder="Member name" autocomplete="off" autocorrect="off" spellcheck="false">
      </div>
      <div class="task-drawer-meta">
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Photo
          </span>
          <div class="team-photo-upload">
            <div class="team-photo-preview" id="edit-member-photo-preview">${existingPhoto ? `<img src="${existingPhoto}" alt="Preview">` : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>'}</div>
            <input type="file" accept="image/*" id="edit-member-photo-input" hidden>
            <button class="btn btn-ghost" id="edit-member-photo-btn">${existingPhoto ? 'Change Photo' : 'Upload Photo'}</button>
            <button class="btn btn-ghost" id="edit-member-photo-remove" style="${existingPhoto ? '' : 'display:none;'}color:var(--danger);">Remove</button>
          </div>
        </div>
        <div class="task-drawer-meta-row">
          <span class="task-drawer-meta-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            Role
          </span>
          <div id="edit-member-role-dropdown"></div>
        </div>
      </div>
      <div class="task-drawer-actions">
        <button class="btn btn-ghost" id="edit-member-delete" style="color:var(--danger);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>Remove</button>
        <button class="btn btn-ghost" id="edit-member-cancel">Cancel</button>
        <button class="btn btn-primary" id="edit-member-submit">Save Changes</button>
      </div>`;
    openDrawer();
    let selectedRole = member.role || 'Member';
    let selectedPhoto = member.photo || null;
    const roleOpts = ['Member', 'Admin', 'Owner'].map(r => ({ value: r, label: r }));
    const roleDrop = buildDropdown(roleOpts, selectedRole, (v) => { selectedRole = v; });
    document.getElementById('edit-member-role-dropdown').appendChild(roleDrop.element);

    const photoInput = document.getElementById('edit-member-photo-input');
    const photoPreview = document.getElementById('edit-member-photo-preview');
    const photoBtn = document.getElementById('edit-member-photo-btn');
    const photoRemove = document.getElementById('edit-member-photo-remove');
    photoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', () => {
      const file = photoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        selectedPhoto = e.target.result;
        photoPreview.innerHTML = `<img src="${selectedPhoto}" alt="Preview">`;
        photoBtn.textContent = 'Change Photo';
        photoRemove.style.display = '';
      };
      reader.readAsDataURL(file);
    });
    photoRemove.addEventListener('click', () => {
      selectedPhoto = null;
      photoInput.value = '';
      photoPreview.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
      photoBtn.textContent = 'Upload Photo';
      photoRemove.style.display = 'none';
    });

    setTimeout(() => document.getElementById('edit-member-name')?.focus(), 100);
    document.getElementById('edit-member-cancel')?.addEventListener('click', closeDrawer);
    document.getElementById('edit-member-delete')?.addEventListener('click', () => {
      if (confirm('Remove this team member?')) { deleteTeamMember(memberId); closeDrawer(); }
    });
    document.getElementById('edit-member-submit')?.addEventListener('click', () => {
      const name = document.getElementById('edit-member-name')?.value?.trim();
      if (!name) { showToast('Please enter a name', 'warning'); return; }
      updateTeamMember(memberId, { name, role: selectedRole, photo: selectedPhoto });
      closeDrawer();
    });
  }

  // --- Drawer close handlers ---
  function initTaskDrawer() {
    const overlay = document.getElementById('task-drawer-overlay');
    const closeBtn = document.getElementById('drawer-close');
    closeBtn?.addEventListener('click', closeDrawer);
    overlay?.addEventListener('click', closeDrawer);
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-dropdown')) closeAllDropdowns();
      const notifDropdown = document.getElementById('notification-dropdown');
      const notifBtn = document.getElementById('notifications-btn');
      if (notifDropdown && notifDropdown.style.display === 'flex' && !notifDropdown.contains(e.target) && !notifBtn?.contains(e.target)) {
        closeNotificationDropdown();
      }
      const userDd = document.getElementById('user-dropdown');
      const userTrig = document.getElementById('user-menu-trigger');
      if (userDd && userDd.style.display === 'block' && !userDd.contains(e.target) && !userTrig?.contains(e.target)) {
        userDd.style.display = 'none';
      }
      const wsDd = document.getElementById('workspace-dropdown');
      const wsTrig = document.getElementById('workspace-switcher');
      if (wsDd && wsDd.style.display === 'block' && !wsDd.contains(e.target) && !wsTrig?.contains(e.target)) {
        wsDd.style.display = 'none';
      }
    });
  }

  function initTaskItemListeners() {
    document.querySelectorAll('.task-item, .kanban-card').forEach(item => {
      const checkbox = item.querySelector('.task-checkbox');
      checkbox?.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        toggleTaskStatus(item.dataset.taskId); 
      });
      item.addEventListener('click', () => {
        openTaskDrawerEdit(item.dataset.taskId);
      });
    });
  }

  function initKanbanDrag() {
    const columns = document.querySelectorAll('.kanban-cards');
    let draggedCard = null;

    function getDragAfterElement(container, y) {
      const elements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];
      return elements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    document.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.kanban-card');
      if (card) { draggedCard = card; setTimeout(() => card.classList.add('dragging'), 0); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); }
    });

    document.addEventListener('dragend', (e) => {
      const card = e.target.closest('.kanban-card');
      if (card) {
        card.classList.remove('dragging');
        draggedCard = null;
        columns.forEach(col => {
          const count = col.querySelectorAll('.kanban-card').length;
          const countEl = col.parentElement.querySelector('.kanban-count');
          if (countEl) countEl.textContent = count;
        });
      }
    });

    columns.forEach(column => {
      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const afterElement = getDragAfterElement(column, e.clientY);
        if (draggedCard) {
          if (afterElement) column.insertBefore(draggedCard, afterElement);
          else column.appendChild(draggedCard);
        }
      });
      column.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedCard) return;
        const taskId = draggedCard.dataset.taskId;
        const newStatus = column.dataset.status;
        if (taskId && newStatus) {
          const data = getData();
          const task = data.tasks.find(t => t.id === taskId);
          if (task) { task.status = newStatus; saveData(data); showToast('Task moved'); }
        }
      });
    });
  }

  function initFAB() {
    const handler = () => {
      const data = getData();
      if (data.projects.length === 0) { navigateTo('projects'); showToast('Create a project first'); }
      else openTaskDrawerCreate(data.projects[0].id);
    };
    document.getElementById('fab')?.addEventListener('click', handler);
    document.getElementById('quick-create')?.addEventListener('click', handler);
  }

  function initNewProjectButtons() {
    document.getElementById('dashboard-new-project')?.addEventListener('click', () => openProjectDrawerCreate());
    document.getElementById('projects-new-project')?.addEventListener('click', () => openProjectDrawerCreate());
    document.getElementById('project-add-task')?.addEventListener('click', () => openTaskDrawerCreate(currentProjectId));
    document.getElementById('tasks-new-task')?.addEventListener('click', () => {
      const data = getData();
      if (data.projects.length === 0) { showToast('Create a project first'); navigateTo('projects'); }
      else openTaskDrawerCreate(data.projects[0].id);
    });
    document.getElementById('calendar-new-event')?.addEventListener('click', () => openEventDrawerCreate());
    document.getElementById('team-invite')?.addEventListener('click', () => openTeamDrawerCreate());
  }

  function initBackButton() {
    document.getElementById('back-to-projects')?.addEventListener('click', () => { currentProjectId = null; navigateTo('projects'); });
  }

  function initSettings() {
    const settingsName = document.getElementById('settings-name');
    const navItems = document.querySelectorAll('.settings-nav-item');
    const sections = document.querySelectorAll('.settings-section');

    navItems.forEach((item, index) => {
      item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        sections.forEach(sec => sec.style.display = 'none');
        item.classList.add('active');
        if (sections[index]) sections[index].style.display = 'block';
      });
    });

    // Initialize display
    sections.forEach((sec, i) => {
      sec.style.display = i === 0 ? 'block' : 'none';
    });

    settingsName?.addEventListener('blur', () => validateInput(settingsName, { required: true, minLength: 2 }));
    settingsName?.addEventListener('input', () => {
      if (settingsName.classList.contains('error') || settingsName.classList.contains('valid'))
        validateInput(settingsName, { required: true, minLength: 2 });
    });
    settingsName?.addEventListener('change', () => {
      const data = getData();
      if (data.user && settingsName.value.trim()) {
        data.user.name = settingsName.value.trim();
        saveData(data);
        updateUserInfo();
        showToast('Profile updated', 'success');
      }
    });

    document.getElementById('date-format-select')?.addEventListener('change', (e) => {
      localStorage.setItem('pm-date-format', e.target.value);
      showToast('Date format updated', 'success');
      refreshCurrentView();
    });
    const savedFormat = localStorage.getItem('pm-date-format');
    if (savedFormat) {
      const sel = document.getElementById('date-format-select');
      if (sel) sel.value = savedFormat;
    }

    initSmtpSettings();

    document.getElementById('export-data-btn')?.addEventListener('click', exportData);
    document.getElementById('import-data-btn')?.addEventListener('click', () => {
      document.getElementById('import-data-input')?.click();
    });
    document.getElementById('import-data-input')?.addEventListener('change', (e) => {
      if (e.target.files[0]) importData(e.target.files[0]);
    });
    document.getElementById('clear-data-btn')?.addEventListener('click', clearAllData);
  }

  function initSmtpSettings() {
    var statusEl = document.getElementById('smtp-status');
    function setStatus(msg, type) {
      statusEl.textContent = msg;
      statusEl.style.color = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--text-tertiary)';
    }

    function getForm() {
      return {
        host: document.getElementById('smtp-host').value.trim(),
        port: parseInt(document.getElementById('smtp-port').value.trim()) || 587,
        secure: document.getElementById('smtp-secure').classList.contains('active'),
        user: document.getElementById('smtp-user').value.trim(),
        pass: document.getElementById('smtp-pass').value.trim(),
        fromName: document.getElementById('smtp-from-name').value.trim() || 'Project Manager',
        fromAddr: document.getElementById('smtp-from-addr').value.trim(),
      };
    }

    function fillForm(cfg) {
      document.getElementById('smtp-host').value = cfg.host || '';
      document.getElementById('smtp-port').value = cfg.port || '587';
      var toggle = document.getElementById('smtp-secure');
      if (cfg.secure) toggle.classList.add('active'); else toggle.classList.remove('active');
      document.getElementById('smtp-user').value = cfg.user || '';
      document.getElementById('smtp-pass').value = '';
      document.getElementById('smtp-from-name').value = cfg.fromName || 'Project Manager';
      document.getElementById('smtp-from-addr').value = cfg.fromAddr || '';
    }

    API.getSmtpConfig().then(function (res) {
      if (res.configured) fillForm(res);
    }).catch(function () {});

    document.getElementById('smtp-save-btn').addEventListener('click', function () {
      var cfg = getForm();
      if (!cfg.host || !cfg.user) {
        setStatus('Host and Username are required.', 'error');
        return;
      }
      if (!cfg.pass && !document.getElementById('smtp-pass').dataset.saved) {
        setStatus('Password is required.', 'error');
        return;
      }
      setStatus('Saving...', '');
      API.saveSmtpConfig(cfg).then(function () {
        document.getElementById('smtp-pass').dataset.saved = '1';
        setStatus('SMTP settings saved.', 'success');
      }).catch(function (err) {
        setStatus(err.body?.error || 'Failed to save.', 'error');
      });
    });

    document.getElementById('smtp-test-btn').addEventListener('click', function () {
      var cfg = getForm();
      if (!cfg.host || !cfg.user || !cfg.pass) {
        setStatus('Fill all required fields first.', 'error');
        return;
      }
      setStatus('Sending test email...', '');
      API.testSmtpConfig(cfg).then(function () {
        setStatus('Test email sent! Check your inbox (or spam).', 'success');
      }).catch(function (err) {
        setStatus(err.body?.error || 'Test failed.', 'error');
      });
    });
  }

  function getNotifications() {
    const data = getData();
    const today = new Date().toISOString().split('T')[0];
    const notifs = [];
    data.tasks.forEach(t => {
      if (t.status !== 'done' && t.dueDate) {
        if (t.dueDate < today) {
          notifs.push({ id: 'overdue-' + t.id, taskId: t.id, type: 'overdue', text: `"${t.name}" is overdue`, date: t.dueDate, icon: 'danger' });
        } else if (t.dueDate === today) {
          notifs.push({ id: 'due-' + t.id, taskId: t.id, type: 'due', text: `"${t.name}" is due today`, date: t.dueDate, icon: 'warning' });
        } else {
          const dueDate = new Date(t.dueDate);
          const diffDays = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 1) {
            notifs.push({ id: 'soon-' + t.id, taskId: t.id, type: 'soon', text: `"${t.name}" due tomorrow`, date: t.dueDate, icon: 'info' });
          }
        }
      }
    });
    return notifs.sort((a, b) => a.date.localeCompare(b.date));
  }

  function updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;
    const notifs = getNotifications();
    const readIds = JSON.parse(localStorage.getItem('pm-read-notifs') || '[]');
    const unread = notifs.filter(n => !readIds.includes(n.id));
    if (unread.length > 0) {
      badge.style.display = 'flex';
      badge.textContent = unread.length > 9 ? '9+' : unread.length;
    } else {
      badge.style.display = 'none';
    }
  }

  function renderNotificationDropdown() {
    const list = document.getElementById('notification-list');
    if (!list) return;
    const notifs = getNotifications();
    const readIds = JSON.parse(localStorage.getItem('pm-read-notifs') || '[]');
    if (notifs.length === 0) {
      list.innerHTML = '<div class="notification-empty">No notifications</div>';
      return;
    }
    list.innerHTML = notifs.map(n => {
      const isUnread = !readIds.includes(n.id);
      const iconColors = { danger: 'var(--danger)', warning: 'var(--warning)', info: 'var(--info)' };
      return `<div class="notification-item ${isUnread ? 'unread' : ''}" data-task-id="${n.taskId}" data-notif-id="${n.id}">
        <div class="notification-item-icon" style="background:${iconColors[n.icon] || 'var(--bg-tertiary)'};color:white;font-size:12px;">${n.icon === 'danger' ? '!' : n.icon === 'warning' ? '!' : 'i'}</div>
        <div class="notification-item-content">
          <div class="notification-item-text">${n.text}</div>
          <div class="notification-item-time">${n.date}</div>
        </div>
      </div>`;
    }).join('');
    list.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', () => {
        const taskId = item.dataset.taskId;
        const notifId = item.dataset.notifId;
        if (taskId) {
          const readIds = JSON.parse(localStorage.getItem('pm-read-notifs') || '[]');
          if (!readIds.includes(notifId)) { readIds.push(notifId); localStorage.setItem('pm-read-notifs', JSON.stringify(readIds)); }
          openTaskDrawerEdit(taskId);
        }
        closeNotificationDropdown();
      });
    });
  }

  function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) return;
    const isOpen = dropdown.style.display === 'flex';
    if (isOpen) { closeNotificationDropdown(); return; }
    renderNotificationDropdown();
    dropdown.style.display = 'flex';
  }

  function closeNotificationDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    updateNotificationBadge();
  }

  function announceToScreenReader(message) {
    const el = document.getElementById('aria-live');
    if (el) { el.textContent = ''; setTimeout(() => { el.textContent = message; }, 50); }
  }

  function formatDate(dateStr, format) {
    if (!dateStr) return '';
    format = format || localStorage.getItem('pm-date-format') || 'yyyy-mm-dd';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    if (format === 'mm/dd/yyyy') return parts[1] + '/' + parts[2] + '/' + parts[0];
    if (format === 'dd/mm/yyyy') return parts[2] + '/' + parts[1] + '/' + parts[0];
    return dateStr;
  }

  function exportData() {
    const data = getData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project-manager-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported', 'success');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data.projects || !data.tasks) { showToast('Invalid backup file', 'error'); return; }
        if (!confirm('This will replace all current data. Continue?')) return;
        showToast('Import not available in cloud mode.', 'warning');
      } catch { showToast('Invalid file format', 'error'); }
    };
    reader.readAsText(file);
  }

  function clearAllData() {
    if (!confirm('Delete ALL data? This cannot be undone.')) return;
    if (!confirm('Are you absolutely sure? All projects, tasks, members and events will be permanently deleted.')) return;
    Promise.all([
      API.del('/projects'),
      API.del('/tasks'),
      API.del('/team'),
      API.del('/events'),
    ]).then(function () {
      state.projects = [];
      state.tasks = [];
      state.team = [];
      state.events = [];
      localStorage.removeItem('pm-last-page');
      localStorage.removeItem('pm-last-project');
      localStorage.removeItem('pm-read-notifs');
      showToast('All data cleared.', 'success');
      refreshCurrentView();
    }).catch(function () { showToast('Failed to clear data', 'error'); });
  }

  function renderActivityFeed(container) {
    if (!container) return;
    API.get('/activity').then(function (logs) {
      if (!logs || logs.length === 0) {
        container.innerHTML = '<p style="font-size:var(--text-sm);color:var(--text-tertiary);padding:var(--space-3) 0;text-align:center;">No recent activity</p>';
        return;
      }
      var icons = {
        'task-created': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
        'task-completed': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        'task-moved': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
        'project-created': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
        'task-deleted': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
        'default': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>'
      };
      container.innerHTML = logs.slice(0, 8).map(function (a) {
        var d = new Date(a.createdAt);
        var timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return '<div class="activity-item"><div class="activity-icon" style="background:var(--bg-tertiary);color:var(--text-secondary);">' + (icons[a.type] || icons['default']) + '</div><div class="activity-content"><div class="activity-text">' + a.description + '</div><div class="activity-time">' + timeStr + '</div></div></div>';
      }).join('');
    }).catch(function () {
      container.innerHTML = '<p style="font-size:var(--text-sm);color:var(--text-tertiary);padding:var(--space-3) 0;text-align:center;">Could not load activity</p>';
    });
  }

  function triggerConfetti() {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;';
    document.body.appendChild(container);
    const colors = [COLORS[0], COLORS[1], COLORS[3], COLORS[6], COLORS[7], '#FFD700', '#FF6B6B', '#4ECDC4'];
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('div');
      const size = 6 + Math.random() * 8;
      piece.style.cssText = 'position:absolute;width:' + size + 'px;height:' + size + 'px;background:' + colors[Math.floor(Math.random() * colors.length)] + ';left:' + Math.random() * 100 + '%;top:-20px;border-radius:' + (Math.random() > 0.5 ? '50%' : '2px') + ';animation:confettiFall ' + (1 + Math.random() * 2) + 's ease-in forwards;animation-delay:' + Math.random() * 1.5 + 's;';
      container.appendChild(piece);
    }
    setTimeout(() => container.remove(), 4000);
  }

  function trapFocus(element) {
    const focusable = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    element.addEventListener('keydown', function trapHandler(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    first.focus();
  }

  function toggleUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    if (!dropdown) return;
    const data = getData();
    if (data.user) {
      document.getElementById('user-dropdown-avatar').textContent = getInitials(data.user.name);
      document.getElementById('user-dropdown-name').textContent = data.user.name;
      document.getElementById('user-dropdown-email').textContent = data.user.email || '';
    }
    const isOpen = dropdown.style.display === 'block';
    dropdown.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      dropdown.querySelectorAll('.user-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          const action = item.dataset.action;
          dropdown.style.display = 'none';
          if (action === 'profile' || action === 'settings') navigateTo('settings');
          if (action === 'export') exportData();
        });
      });
    }
  }

  function toggleWorkspaceDropdown() {
    const dropdown = document.getElementById('workspace-dropdown');
    if (!dropdown) return;
    const data = getData();
    if (data.user) {
      document.getElementById('ws-dropdown-avatar').textContent = getInitials(data.user.name);
      document.getElementById('ws-dropdown-name').textContent = data.user.name;
      document.getElementById('ws-dropdown-email').textContent = data.user.email || '';
    }
    const isOpen = dropdown.style.display === 'block';
    dropdown.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      dropdown.querySelectorAll('.workspace-dropdown-item').forEach(item => {
        item.onclick = () => {
          dropdown.style.display = 'none';
          if (item.dataset.action === 'profile' || item.dataset.action === 'settings') navigateTo('settings');
        };
      });
    }
  }

  function showToast(message, type, duration) {
    type = type || 'default';
    duration = duration || 3000;
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    const icons = {
      success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
      default: ''
    };
    toast.innerHTML = (icons[type] || '') + '<span class="toast-message">' + message + '</span><button class="toast-close" aria-label="Dismiss"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>';
    container.appendChild(toast);
    toast.querySelector('.toast-close')?.addEventListener('click', () => removeToast(toast));
    setTimeout(() => removeToast(toast), duration);
    announceToScreenReader(message);
  }

  function removeToast(toast) {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 200);
  }

  function setButtonLoading(btn, loading) {
    btn.classList.toggle('btn-loading', loading);
    btn.disabled = loading;
  }

  function validateInput(input, rules) {
    rules = rules || {};
    const value = input.value.trim();
    let isValid = true;
    let message = '';
    input.classList.remove('valid', 'error', 'warning');
    const hint = input.parentElement?.querySelector('.input-hint');
    if (hint) hint.remove();
    if (rules.required && !value) { isValid = false; message = rules.requiredMessage || 'This field is required'; }
    if (rules.minLength && value.length < rules.minLength) { isValid = false; message = rules.minLengthMessage || 'Must be at least ' + rules.minLength + ' characters'; }
    if (!isValid) {
      input.classList.add('error');
      if (message) {
        const hintEl = document.createElement('div');
        hintEl.className = 'input-hint error';
        hintEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>' + message;
        input.parentElement?.appendChild(hintEl);
      }
    } else if (value && (rules.required || rules.minLength)) {
      input.classList.add('valid');
    }
    return isValid;
  }

  function showSkeleton(container, count, type) {
    count = count || 3;
    type = type || 'card';
    const skeletons = [];
    for (let i = 0; i < count; i++) {
      const skel = document.createElement('div');
      skel.className = 'skeleton skeleton-' + type;
      container.appendChild(skel);
      skeletons.push(skel);
    }
    return skeletons;
  }

  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'g') { window._gKeyPending = true; setTimeout(() => { window._gKeyPending = false; }, 1000); }
      else if (window._gKeyPending) {
        if (e.key === 'd') { e.preventDefault(); navigateTo('dashboard'); }
        if (e.key === 'p') { e.preventDefault(); navigateTo('projects'); }
        if (e.key === 'c') { e.preventDefault(); navigateTo('calendar'); }
        window._gKeyPending = false;
      }
      if (e.key === 't' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); navigateTo('tasks'); }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); document.getElementById('command-palette')?.classList.add('active'); setTimeout(() => document.querySelector('.command-palette-input')?.focus(), 50); }
    });
  }

  function initResizeHandler() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 768) { sidebar?.classList.remove('mobile-open'); document.body.classList.remove('sidebar-open'); }
      }, 150);
    });
  }

  function initScrollAnimations() {
    if (typeof IntersectionObserver === 'undefined') return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    function watch(el) {
      if (!el) return;
      if (el.matches && (el.matches('.anim-fade-up') || el.matches('.anim-fade-in') || el.matches('.anim-stagger'))) {
        observer.observe(el);
      }
      el.querySelectorAll('.anim-fade-up, .anim-fade-in, .anim-stagger').forEach(function (child) {
        observer.observe(child);
      });
    }
    watch(document.querySelector('.page-content'));
    var contentArea = document.querySelector('.page-content');
    if (contentArea) {
      var mutationObs = new MutationObserver(function () {
        watch(contentArea);
      });
      mutationObs.observe(contentArea, { childList: true, subtree: true });
    }
  }

    document.addEventListener('DOMContentLoaded', function () {
    function showAuth(id) {
      const views = ['auth-login','auth-signup','auth-forgot','auth-verify'];
      const currentView = views.find(v => {
        const el = document.getElementById(v);
        return el && el.style.display !== 'none';
      });

      if (currentView === id) return;

      const newEl = document.getElementById(id);
      const oldEl = currentView ? document.getElementById(currentView) : null;

      if (oldEl && newEl) {
        const isForward = (views.indexOf(id) > views.indexOf(currentView));
        oldEl.classList.add(isForward ? 'exiting-left' : 'exiting-right');
        
        // Orchestrate disappearance of children
        const children = oldEl.querySelectorAll('.onboarding-title, .onboarding-subtitle, .onboarding-step, .onboarding-btn');
        children.forEach((child, i) => {
          child.style.transition = 'all 0.4s var(--ease-out-expo)';
          child.style.opacity = '0';
          child.style.transform = 'translateY(-10px)';
          child.style.filter = 'blur(4px)';
        });

        const onEnd = () => {
          oldEl.style.display = 'none';
          oldEl.classList.remove('exiting-left', 'exiting-right');
          oldEl.removeEventListener('animationend', onEnd);
          
          newEl.style.display = '';
          newEl.style.animation = 'none';
          
          // Reset new children styles
          const newChildren = newEl.querySelectorAll('.onboarding-title, .onboarding-subtitle, .onboarding-step, .onboarding-btn');
          newChildren.forEach(child => {
            child.style.opacity = '';
            child.style.transform = '';
            child.style.filter = '';
            child.style.transition = '';
          });

          newEl.offsetHeight;
          newEl.style.animation = (isForward ? 'slideLeftIn' : 'slideRightIn') + ' 0.7s var(--ease-out-expo) both';
        };
        oldEl.addEventListener('animationend', onEnd);
        setTimeout(onEnd, 450);
      } else if (newEl) {
        views.forEach(v => {
          const el = document.getElementById(v);
          if (el) el.style.display = 'none';
        });
        newEl.style.display = '';
      }
    }

    function showAuthError(id, msg) {
      var el = document.getElementById(id);
      if (el) { el.style.display = ''; el.textContent = msg; }
    }

    function hideAuthError(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }

    function setAuthLoading(btnId, loading) {
      var btn = document.getElementById(btnId);
      if (btn) { btn.disabled = loading; btn.textContent = loading ? 'Please wait...' : btn.dataset.originalText || btn.textContent; }
    }

    function initPremiumInteractions() {
      // Mouse Glow Tracking for cards
      document.addEventListener('mousemove', function (e) {
        var cards = document.querySelectorAll('.stat-card, .project-card, .widget, .chart-card, .task-item, .team-member-card');
        for (var i = 0; i < cards.length; i++) {
          var rect = cards[i].getBoundingClientRect();
          if (e.clientX > rect.left - 100 && e.clientX < rect.right + 100 && e.clientY > rect.top - 100 && e.clientY < rect.bottom + 100) {
            var x = ((e.clientX - rect.left) / rect.width) * 100;
            var y = ((e.clientY - rect.top) / rect.height) * 100;
            cards[i].style.setProperty('--mouse-x', x + '%');
            cards[i].style.setProperty('--mouse-y', y + '%');
          }
        }
      });

      // Magnetic Elements
      var magneticSelectors = '.btn-primary, .dashboard-banner-btn, .action-btn';
      document.addEventListener('mousemove', function (e) {
        var els = document.querySelectorAll(magneticSelectors);
        for (var i = 0; i < els.length; i++) {
          var rect = els[i].getBoundingClientRect();
          var centerX = rect.left + rect.width / 2;
          var centerY = rect.top + rect.height / 2;
          var distance = Math.sqrt(Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2));
          
          if (distance < 60) {
            var x = (e.clientX - centerX) * 0.2;
            var y = (e.clientY - centerY) * 0.2;
            els[i].style.transform = 'translate(' + x + 'px, ' + y + 'px)';
            els[i].style.transition = 'transform 0.1s var(--ease-out)';
          } else {
            els[i].style.transform = '';
            els[i].style.transition = 'transform 0.4s var(--ease-spring)';
          }
        }
      });
    }

    function bootApp() {
      initNavigation();
      initSidebar();
      initDarkMode();
      initCommandPalette();
      initTaskDrawer();
      initFAB();
      initNewProjectButtons();
      initBackButton();
      initSettings();
      initProfilePicture();
      initKeyboardShortcuts();
      initResizeHandler();
      initScrollAnimations();
      initPremiumInteractions();
      document.getElementById('notifications-btn')?.addEventListener('click', function (e) { e.stopPropagation(); toggleNotificationDropdown(); });
      document.getElementById('mark-all-read')?.addEventListener('click', function (e) {
        e.stopPropagation();
        var notifs = getNotifications();
        localStorage.setItem('pm-read-notifs', JSON.stringify(notifs.map(function (n) { return n.id; })));
        renderNotificationDropdown();
        updateNotificationBadge();
      });
      document.getElementById('tasks-search')?.addEventListener('input', debounce(function () { requestAnimationFrame(function () { renderTasks(); }); }, 300));
      document.getElementById('tasks-sort')?.addEventListener('change', function () { renderTasks(); });
      document.querySelectorAll('#tasks-filter-bar .filter-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          document.querySelectorAll('#tasks-filter-bar .filter-chip').forEach(function (c) { c.classList.remove('active'); });
          chip.classList.add('active');
          renderTasks();
        });
      });
      document.getElementById('projects-search')?.addEventListener('input', debounce(function () { requestAnimationFrame(function () { renderProjects(); }); }, 300));
      document.getElementById('user-menu-trigger')?.addEventListener('click', function (e) { e.stopPropagation(); toggleUserMenu(); });
      document.getElementById('workspace-switcher')?.addEventListener('click', function (e) { e.stopPropagation(); toggleWorkspaceDropdown(); });
      document.querySelector('.sidebar-kbd-hint')?.addEventListener('click', function () {
        document.getElementById('command-palette')?.classList.add('active');
        document.getElementById('command-palette').style.display = 'flex';
        setTimeout(function () { document.querySelector('.command-palette-input')?.focus(); }, 50);
      });

      if (state.user) {
        updateUserInfo();
        updateProjectCount();
        updateCommandPaletteProjects();
        var lastPage = localStorage.getItem('pm-last-page');
        if (lastPage === 'project-detail') {
          navigateTo('project-detail', localStorage.getItem('pm-last-project') || state.projects[0]?.id);
        } else if (lastPage) {
          navigateTo(lastPage);
        } else {
          navigateTo('dashboard');
        }
      }
    }

    var onboarding = document.getElementById('onboarding');
    if (Auth.isAuthenticated()) {
      loadAllData().then(function () {
        onboarding?.classList.add('hidden');
        bootApp();
      }).catch(function () {
        onboarding?.classList.remove('hidden');
        showAuth('auth-login');
      });
    } else {
      showAuth('auth-login');
    }

    document.getElementById('auth-show-signup')?.addEventListener('click', function (e) { e.preventDefault(); showAuth('auth-signup'); });
    document.getElementById('auth-show-login-from-signup')?.addEventListener('click', function (e) { e.preventDefault(); showAuth('auth-login'); });
    document.getElementById('auth-show-forgot')?.addEventListener('click', function (e) { e.preventDefault(); showAuth('auth-forgot'); });
    document.getElementById('auth-show-login-from-forgot')?.addEventListener('click', function (e) { e.preventDefault(); showAuth('auth-login'); });
    document.getElementById('auth-show-login-from-verify')?.addEventListener('click', function (e) { e.preventDefault(); showAuth('auth-login'); });

    document.querySelectorAll('.password-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.dataset.target;
        var input = document.getElementById(id);
        if (!input) return;
        var isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        this.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        this.innerHTML = isHidden
          ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
          : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
      });
    });

    document.getElementById('login-submit')?.addEventListener('click', function () {
      var email = document.getElementById('login-email')?.value?.trim();
      var password = document.getElementById('login-password')?.value;
      if (!email || !password) { showAuthError('login-error', 'Please enter your email and password.'); return; }
      hideAuthError('login-error');
      setAuthLoading('login-submit', true);
      Auth.login(email, password).then(function () {
        loadAllData().then(function () {
          onboarding?.classList.add('hidden');
          bootApp();
        });
      }).catch(function (err) {
        showAuthError('login-error', err.body?.error || err.message || 'Sign in failed.');
        setAuthLoading('login-submit', false);
      });
    });

    document.getElementById('login-password')?.addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('login-submit')?.click(); });

    document.getElementById('signup-submit')?.addEventListener('click', function () {
      var name = document.getElementById('signup-name')?.value?.trim();
      var email = document.getElementById('signup-email')?.value?.trim();
      var password = document.getElementById('signup-password')?.value;
      if (!name || !email || !password) { showAuthError('signup-error', 'Please fill in all fields.'); return; }
      if (password.length < 8) { showAuthError('signup-error', 'Password must be at least 8 characters.'); return; }
      hideAuthError('signup-error');
      setAuthLoading('signup-submit', true);
      Auth.signup(name, email, password).then(function () {
        setAuthLoading('signup-submit', false);
        showAuth('auth-verify');
      }).catch(function (err) {
        showAuthError('signup-error', err.body?.error || err.message || 'Sign up failed.');
        setAuthLoading('signup-submit', false);
      });
    });

    document.getElementById('signup-password')?.addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('signup-submit')?.click(); });

    document.getElementById('forgot-submit')?.addEventListener('click', function () {
      var email = document.getElementById('forgot-email')?.value?.trim();
      if (!email) { showAuthError('forgot-error', 'Please enter your email.'); return; }
      hideAuthError('forgot-error');
      document.getElementById('forgot-success').style.display = 'none';
      setAuthLoading('forgot-submit', true);
      Auth.forgotPassword(email).then(function () {
        setAuthLoading('forgot-submit', false);
        document.getElementById('forgot-success').textContent = 'If that email is registered, a reset link has been sent.';
        document.getElementById('forgot-success').style.display = '';
      }).catch(function (err) {
        showAuthError('forgot-error', err.body?.error || err.message || 'Request failed.');
        setAuthLoading('forgot-submit', false);
      });
    });

    document.getElementById('forgot-email')?.addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('forgot-submit')?.click(); });
  });
})();
