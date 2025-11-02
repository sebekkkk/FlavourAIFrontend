/* app.js - FlavourAI Minimalist v1
   Author: GPT-5 (2025)
   Backend: http://food-tanzania.gl.at.ply.gg:28731/apiv1
*/

(function () {
  'use strict';

  // ---------- Konfiguracja ----------
  const CONFIG = {
    API_BASE: 'http://food-tanzania.gl.at.ply.gg:28731/apiv1',
    TOKEN_KEY: 'flavourai_token',
    MSG_TIMEOUT: 6000
  };

  // ---------- Stan aplikacji ----------
  const STATE = {
    token: null,
    currentUser: null,
    recipes: []
  };

  // ---------- Helpery DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Cache elementów
  const nodes = {
    // views
    views: $$('.view'),
    loginView: $('#login-view'),
    registerView: $('#register-view'),
    recipesView: $('#recipes-view'),
    genIdeaView: $('#generate-idea-view'),
    genIngredientsView: $('#generate-ingredients-view'),
    recipeDetailsView: $('#recipe-details-view'),
    profileView: $('#profile-view'),
    adminView: $('#admin-view'),

    // nav and misc
    appNav: $('#app-nav'),
    loadingOverlay: $('#loading-overlay'),
    loadingText: $('#loading-text'),

    // messages
    loginMessage: $('#login-message'),
    registerMessage: $('#register-message'),
    recipesMessage: $('#recipes-message'),
    generateIdeaMessage: $('#generate-idea-message'),
    generateIngredientsMessage: $('#generate-ingredients-message'),
    recipeDetailsMessage: $('#recipe-details-message'),
    profileMessage: $('#profile-message'),
    deleteMessage: $('#delete-message'),
    adminMessage: $('#admin-message'),

    // forms
    loginForm: $('#login-form'),
    registerForm: $('#register-form'),
    generateIdeaForm: $('#generate-idea-form'),
    generateIngredientsForm: $('#generate-ingredients-form'),
    updateProfileForm: $('#update-profile-form'),
    deleteAccountForm: $('#delete-account-form'),
    adminEditForm: $('#admin-edit-user-form'),

    // recipe lists / displays
    recipeList: $('#recipe-list'),
    ideaResult: $('#idea-result'),
    ideaResultContent: $('#idea-result-content'),
    ingredientsResult: $('#ingredients-result'),
    ingredientsResultContent: $('#ingredients-result-content'),
    recipeDetailsContent: $('#recipe-details-content'),
    recipeDetailsTitle: $('#recipe-details-title'),

    // profile fields
    userEmail: $('#user-email'),
    userUsername: $('#user-username'),
    userRole: $('#user-role'),

    // admin
    adminUserList: $('#admin-user-list'),
    adminEditContainer: $('#admin-edit-container'),

    // ingredient inputs
    ingredientInputs: $('#ingredient-inputs'),
    addIngredientBtn: $('#add-ingredient'),

    // buttons
    navToRegister: $('#nav-to-register'),
    navToLogin: $('#nav-to-login'),
    navToGenIdea: $('#nav-to-gen-idea'),
    navToGenIngredients: $('#nav-to-gen-ingredients'),
    ideaSaveBtn: $('#idea-save-btn'),
    ingredientsSaveBtn: $('#ingredients-save-btn'),
    navToRecipesBtns: $$('.nav-to-recipes')
  };

  // ---------- UI utilities ----------
  function showView(id) {
    nodes.views.forEach(v => v.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showLoading(text = 'Ładuję...') {
    if (nodes.loadingText) nodes.loadingText.textContent = text;
    if (nodes.loadingOverlay) nodes.loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    if (nodes.loadingOverlay) nodes.loadingOverlay.classList.add('hidden');
  }

  function showMessage(node, text, type = 'error') {
    if (!node) return;
    node.textContent = text;
    node.classList.remove('error', 'success');
    node.classList.add(type === 'success' ? 'success' : 'error');
    node.style.display = 'block';
    setTimeout(() => {
      try { node.style.display = 'none'; } catch (e) {}
    }, CONFIG.MSG_TIMEOUT);
  }

  // ---------- Token / Auth ----------
  function saveToken(token) {
    STATE.token = token;
    if (token) localStorage.setItem(CONFIG.TOKEN_KEY, token);
    else localStorage.removeItem(CONFIG.TOKEN_KEY);
  }

  function loadToken() {
    if (!STATE.token) STATE.token = localStorage.getItem(CONFIG.TOKEN_KEY);
    return STATE.token;
  }

  function clearAuth() {
    saveToken(null);
    STATE.currentUser = null;
  }

  function authHeaders() {
    const token = loadToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  // ---------- API helpers ----------
  async function apiFetch(path, opts = {}) {
    const url = CONFIG.API_BASE + path;
    const optsFinal = Object.assign({ method: 'GET', headers: {} }, opts);
    optsFinal.headers = Object.assign({}, optsFinal.headers || {}, { 'Content-Type': 'application/json' });

    // attach token if present
    const token = loadToken();
    if (token) optsFinal.headers['Authorization'] = `Bearer ${token}`;

    let resp;
    try {
      resp = await fetch(url, optsFinal);
    } catch (err) {
      throw new Error('Błąd sieci. Sprawdź połączenie z backendem.');
    }

    // 401: usuwamy token i rzucamy
    if (resp.status === 401) {
      clearAuth();
      throw new Error('Brak autoryzacji. Zaloguj się ponownie.');
    }

    // próbujemy sparsować JSON
    const text = await resp.text().catch(() => '');
    let data = {};
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
    }

    if (!resp.ok) {
      const errMsg = (data && data.message) || resp.statusText || `Błąd serwera (${resp.status})`;
      const err = new Error(errMsg);
      err.status = resp.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  // API convenience
  const API = {
    get: (p) => apiFetch(p, { method: 'GET' }),
    post: (p, body) => apiFetch(p, { method: 'POST', body: JSON.stringify(body) }),
    patch: (p, body) => apiFetch(p, { method: 'PATCH', body: JSON.stringify(body) }),
    del: (p, body = null) => apiFetch(p, body ? { method: 'DELETE', body: JSON.stringify(body) } : { method: 'DELETE' })
  };

  // ---------- Auth service ----------
  const Auth = {
    login: async (email, password) => {
      const data = await API.post('/auth/login', { email, password });
      if (!data || !data.token) throw new Error('Brak tokena w odpowiedzi z API.');
      saveToken(data.token);
      await User.fetchProfile(); // populate user
      UI.updateNav();
    },

    register: async (email, password, username) => {
      // API wysyła e-mail weryfikacyjny — nie logujemy
      await API.post('/auth/register', { email, password, username });
    },

    logout: () => {
      clearAuth();
      UI.updateNav();
      showView('login-view');
      showMessage(nodes.loginMessage, 'Wylogowano pomyślnie.', 'success');
    }
  };

  // ---------- User service ----------
  const User = {
    fetchProfile: async (showLoadingFlag = false) => {
      if (showLoadingFlag) showLoading('Pobieram profil...');
      try {
        const user = await API.get('/user/me');
        STATE.currentUser = user;
        // normalize role
        if (!user.role) user.role = user.idAdmin ? 'Admin' : (user.role || 'User');
        // update profile UI data
        nodes.userEmail.textContent = user.email || '—';
        nodes.userUsername.textContent = user.username || '—';
        nodes.userRole.textContent = user.role || 'User';
        UI.updateNav();
        return user;
      } finally {
        if (showLoadingFlag) hideLoading();
      }
    },

    updateProfile: async (body) => {
      return await API.patch('/user/me', body);
    },

    deleteAccount: async (password) => {
      // According to API, DELETE /user/me with body { password }
      return await API.del('/user/me', { password });
    }
  };

  // ---------- Recipes service ----------
  const Recipes = {
    list: async () => {
      const data = await API.get('/recipe');
      // Expect array or object
      STATE.recipes = Array.isArray(data) ? data : (data.recipes || []);
      return STATE.recipes;
    },

    get: async (id) => {
      return await API.get(`/recipe/${id}`);
    },

    delete: async (id) => {
      return await API.del(`/recipe/${id}`);
    },

    // generateV1: intention-based
    generateFromIdea: async ({ intention, maxTime, dificultyLevel, numberOfPortions }) => {
      const body = { intention, maxTime: Number(maxTime), dificultyLevel: Number(dificultyLevel) };
      if (numberOfPortions) body.numberOfPortions = Number(numberOfPortions);
      return await API.post('/recipe/generateV1', body);
    },

    // generateV2: ingredients-based
    generateFromIngredients: async ({ ingridientList, maxTime, dificultyLevel, numberOfPortions }) => {
      const body = { ingridientList, maxTime: Number(maxTime), dificultyLevel: Number(dificultyLevel) };
      if (numberOfPortions) body.numberOfPortions = Number(numberOfPortions);
      return await API.post('/recipe/generateV2', body);
    }
  };

  // ---------- Admin service ----------
  const Admin = {
    listUsers: async () => API.get('/admin/users'),
    getUser: async (userId) => API.get(`/admin/user/${userId}`),
    updateUser: async (userId, body) => API.patch(`/admin/user/update/${userId}`, body),
    deleteUser: async (userId) => API.del(`/admin/user/delete/${userId}`)
  };

  // ---------- UI rendering ----------
  const UI = {
    updateNav: () => {
      const token = loadToken();
      nodes.appNav.innerHTML = '';
      if (token && STATE.currentUser) {
        const isAdmin = STATE.currentUser.role === 'Admin';
        // create buttons
        const btn = (text, view, cls = '') => {
          const b = document.createElement('button');
          b.textContent = text;
          if (cls) b.className = cls;
          b.addEventListener('click', () => showView(view));
          return b;
        };
        nodes.appNav.appendChild(btn('Moje przepisy', 'recipes-view'));
        nodes.appNav.appendChild(btn('Generacja z pomysłu', 'generate-idea-view'));
        nodes.appNav.appendChild(btn('Generacja z listy składników', 'generate-ingredients-view'));
        if (isAdmin) nodes.appNav.appendChild(btn('Panel admina', 'admin-view'));
        nodes.appNav.appendChild(btn('Profil', 'profile-view'));
        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = 'Wyloguj';
        logoutBtn.addEventListener('click', () => { Auth.logout(); });
        nodes.appNav.appendChild(logoutBtn);
      } else {
        const btnLogin = document.createElement('button');
        btnLogin.textContent = 'Zaloguj';
        btnLogin.addEventListener('click', () => showView('login-view'));
        const btnReg = document.createElement('button');
        btnReg.textContent = 'Zarejestruj';
        btnReg.addEventListener('click', () => showView('register-view'));
        nodes.appNav.appendChild(btnLogin);
        nodes.appNav.appendChild(btnReg);
      }
    },

    renderRecipesList: (recipes) => {
      nodes.recipeList.innerHTML = '';
      if (!recipes || recipes.length === 0) {
        const li = document.createElement('li');
        li.className = 'card';
        li.innerHTML = '<p>Brak przepisów. Wygeneruj pierwszy przepis.</p>';
        nodes.recipeList.appendChild(li);
        return;
      }
      // render each recipe
      recipes.forEach(r => {
        const li = document.createElement('li');
        li.className = 'card';
        const title = r.tytul || r.title || r.name || 'Untitled';
        const owner = r.ownerUsername || r.owner || (STATE.currentUser && STATE.currentUser.username) || '—';
        const created = r.createdAt ? new Date(r.createdAt).toLocaleString() : '';
        li.innerHTML = `
          <h3>${escapeHtml(title)}</h3>
          <p>${(r.summary || r.opis || '').substring(0, 160)}</p>
          <p style="color:#999; font-size:0.85rem;">Autor: ${escapeHtml(owner)} ${created ? ' • ' + created : ''}</p>
        `;
        const actions = document.createElement('div');
        actions.className = 'actions';
        const btnView = document.createElement('button');
        btnView.className = 'btn ghost';
        btnView.textContent = 'Szczegóły';
        btnView.addEventListener('click', async () => {
          try {
            showLoading('Ładuję szczegóły przepisu...');
            const detail = await Recipes.get(r._id || r.id);
            UI.renderRecipeDetails(detail);
            showView('recipe-details-view');
          } catch (err) {
            showMessage(nodes.recipesMessage, `Nie udało się pobrać przepisu: ${err.message}`);
          } finally {
            hideLoading();
          }
        });

        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn danger';
        btnDelete.textContent = 'Usuń';
        btnDelete.addEventListener('click', async () => {
          if (!confirm('Na pewno usunąć ten przepis?')) return;
          try {
            showLoading('Usuwam przepis...');
            await Recipes.delete(r._id || r.id);
            await Handlers.fetchAndRenderRecipes();
            showMessage(nodes.recipesMessage, 'Przepis usunięty.', 'success');
          } catch (err) {
            showMessage(nodes.recipesMessage, `Błąd usuwania: ${err.message}`);
          } finally {
            hideLoading();
          }
        });

        actions.appendChild(btnView);
        // only owner or admin can delete; we assume backend enforces, but hide delete for other owners
        const isOwner = (STATE.currentUser && (r.ownerId === STATE.currentUser._id || r.ownerId === STATE.currentUser.id || r.ownerUsername === STATE.currentUser.username));
        if (isOwner || (STATE.currentUser && STATE.currentUser.role === 'Admin')) {
          actions.appendChild(btnDelete);
        }
        li.appendChild(actions);
        nodes.recipeList.appendChild(li);
      });
    },

    renderRecipeDetails: (data) => {
      // Accept either object with recipe or recipe itself
      const recipe = data.recipe || data;
      const title = recipe.tytul || recipe.title || 'Brak tytułu';
      const owner = data.ownerUsername || recipe.ownerUsername || recipe.owner || '—';
      nodes.recipeDetailsTitle.textContent = title;
      // Build HTML
      const ingredientsArr = recipe.skladniki || recipe.ingredients || [];
      const stepsArr = recipe.instrukcje || recipe.steps || recipe.instructions || [];

      const meta = [
        `Porcje: ${recipe.porcje || recipe.numberOfPortions || '—'}`,
        `Trudność: ${mapDifficulty(recipe.trudnosc || recipe.dificultyLevel)}`,
        `Czas: ${recipe.czas_calkowity_minuty || recipe.totalTime || recipe.maxTime || '—'} min`
      ].join(' • ');

      const ingredientsHtml = Array.isArray(ingredientsArr) && ingredientsArr.length
        ? `<ul>${ingredientsArr.map(it => `<li>${escapeHtml(((it.ilosc || it.amount) || ''))} ${escapeHtml((it.nazwa || it.name) || '')}</li>`).join('')}</ul>`
        : '<p>Brak danych o składnikach.</p>';

      const stepsHtml = Array.isArray(stepsArr) && stepsArr.length
        ? `<ol>${stepsArr.map((s, idx) => `<li>${escapeHtml(s.opis || s.description || s.text || s) }</li>`).join('')}</ol>`
        : '<p>Brak kroków.</p>';

      const nutrition = recipe.wartosci_odzywcze_na_porcje || recipe.nutrition || {};
      const nutritionHtml = `
        <p>Kalorie: ${nutrition.kalorie_kcal || nutrition.calories || '—'}</p>
        <p>Białko: ${nutrition.bialko_g || nutrition.protein || '—'}</p>
        <p>Węglowodany: ${nutrition.weglowodany_g || nutrition.carbs || '—'}</p>
        <p>Tłuszcze: ${nutrition.tluszcze_g || nutrition.fat || '—'}</p>
      `;

      nodes.recipeDetailsContent.innerHTML = `
        <div style="margin-bottom:12px;">
          <strong>Autor:</strong> ${escapeHtml(owner)}<br>
          <small style="color:#999">${escapeHtml(meta)}</small>
        </div>
        <h3>Składniki</h3>
        ${ingredientsHtml}
        <h3>Instrukcje</h3>
        ${stepsHtml}
        <h3>Wartości odżywcze (na porcję)</h3>
        ${nutritionHtml}
        <h3>Opis</h3>
        <p>${escapeHtml(recipe.opis || recipe.description || recipe.summary || '')}</p>
      `;
    }
  };

  // ---------- Handlers (formularze + działania) ----------
  const Handlers = {
    init: () => {
      // navigation buttons
      if (nodes.navToRegister) nodes.navToRegister.addEventListener('click', () => showView('register-view'));
      if (nodes.navToLogin) nodes.navToLogin.addEventListener('click', () => showView('login-view'));
      if (nodes.navToGenIdea) nodes.navToGenIdea.addEventListener('click', () => showView('generate-idea-view'));
      if (nodes.navToGenIngredients) nodes.navToGenIngredients.addEventListener('click', () => showView('generate-ingredients-view'));
      nodes.navToRecipesBtns.forEach(b => b.addEventListener('click', () => showView('recipes-view')));

      // forms
      if (nodes.loginForm) nodes.loginForm.addEventListener('submit', Handlers.handleLogin);
      if (nodes.registerForm) nodes.registerForm.addEventListener('submit', Handlers.handleRegister);
      if (nodes.generateIdeaForm) nodes.generateIdeaForm.addEventListener('submit', Handlers.handleGenerateIdea);
      if (nodes.generateIngredientsForm) nodes.generateIngredientsForm.addEventListener('submit', Handlers.handleGenerateIngredients);
      if (nodes.updateProfileForm) nodes.updateProfileForm.addEventListener('submit', Handlers.handleUpdateProfile);
      if (nodes.deleteAccountForm) nodes.deleteAccountForm.addEventListener('submit', Handlers.handleDeleteAccount);
      if (nodes.adminEditForm) nodes.adminEditForm.addEventListener('submit', Handlers.handleAdminEditSave);

      // admin cancel
      const adminCancel = $('#admin-cancel-edit');
      if (adminCancel) adminCancel.addEventListener('click', () => nodes.adminEditContainer.classList.add('hidden'));

      // ingredient inputs dynamic
      if (nodes.addIngredientBtn) {
        nodes.addIngredientBtn.addEventListener('click', () => UIHelpers.addIngredientInput());
      }
      // initialize with a couple inputs
      UIHelpers.addIngredientInput('cebula', '1 szt.');
      UIHelpers.addIngredientInput('jajka', '2 szt.');

      // save buttons for generated results
      if (nodes.ideaSaveBtn) nodes.ideaSaveBtn.addEventListener('click', Handlers.handleSaveIdeaResult);
      if (nodes.ingredientsSaveBtn) nodes.ingredientsSaveBtn.addEventListener('click', Handlers.handleSaveIngredientsResult);

      // initial nav render
      UI.updateNav();

      // Try load token and if present fetch profile & recipes
      if (loadToken()) {
        // attempt to fetch profile and recipes
        (async () => {
          try {
            showLoading('Weryfikuję sesję...');
            await User.fetchProfile(false);
            await Handlers.fetchAndRenderRecipes();
            UI.updateNav();
            showView('recipes-view');
          } catch (err) {
            // token invalid or expired -> clear and show login
            clearAuth();
            UI.updateNav();
            showView('login-view');
            showMessage(nodes.loginMessage, 'Sesja wygasła lub token jest nieprawidłowy. Zaloguj się ponownie.');
          } finally {
            hideLoading();
          }
        })();
      } else {
        showView('login-view');
      }
    },

    // Login
    handleLogin: async (e) => {
      e.preventDefault();
      const email = $('#login-email').value.trim();
      const password = $('#login-password').value;
      if (!email || !password) {
        showMessage(nodes.loginMessage, 'Uzupełnij wszystkie pola.');
        return;
      }
      try {
        showLoading('Logowanie...');
        await Auth.login(email, password);
        showMessage(nodes.recipesMessage, 'Zalogowano pomyślnie.', 'success');
        await Handlers.fetchAndRenderRecipes();
        showView('recipes-view');
      } catch (err) {
        showMessage(nodes.loginMessage, `Błąd logowania: ${err.message}`);
      } finally {
        hideLoading();
      }
    },

    // Register
    handleRegister: async (e) => {
      e.preventDefault();
      const email = $('#register-email').value.trim();
      const username = $('#register-username').value.trim();
      const password = $('#register-password').value;
      if (!email || !username || !password) {
        showMessage(nodes.registerMessage, 'Uzupełnij wszystkie pola.');
        return;
      }
      try {
        showLoading('Rejestracja...');
        await Auth.register(email, password, username);
        showMessage(nodes.registerMessage, 'Zarejestrowano. Sprawdź e-mail, potwierdź konto.', 'success');
        // go to login
        setTimeout(() => showView('login-view'), 1000);
      } catch (err) {
        showMessage(nodes.registerMessage, `Błąd rejestracji: ${err.message}`);
      } finally {
        hideLoading();
      }
    },

    // Fetch recipes and render
    fetchAndRenderRecipes: async () => {
      try {
        showLoading('Ładuję przepisy...');
        const list = await Recipes.list();
        UI.renderRecipesList(list);
      } catch (err) {
        showMessage(nodes.recipesMessage, `Błąd pobierania przepisów: ${err.message}`);
      } finally {
        hideLoading();
      }
    },

    // Generate from idea (V1)
    handleGenerateIdea: async (e) => {
      e.preventDefault();
      const intention = $('#idea-intention').value.trim();
      const maxTime = $('#idea-maxTime').value;
      const dificultyLevel = $('#idea-difficulty').value;
      const numberOfPortions = $('#idea-portions').value;

      if (!intention || !maxTime || !dificultyLevel) {
        showMessage(nodes.generateIdeaMessage, 'Uzupełnij wymagane pola.');
        return;
      }

      try {
        showLoading('Generuję przepis (z pomysłu)...');
        const result = await Recipes.generateFromIdea({ intention, maxTime, dificultyLevel, numberOfPortions });
        // API according to docs returns created recipe (201)
        nodes.ideaResultContent.innerHTML = prettyRecipeOutput(result);
        nodes.ideaResult.classList.remove('hidden');
        nodes.generateIdeaForm.classList.add('hidden');
        // save last generated to temporary storage for saving action
        STATE._lastGenerated = result;
      } catch (err) {
        // if API returns 200 meaning "AI nie może" in V2 case, handle accordingly
        showMessage(nodes.generateIdeaMessage, `Błąd generowania: ${err.message}`);
      } finally {
        hideLoading();
      }
    },

    // Save idea result (if API already saved on generation, this may be unnecessary but keep safe)
    handleSaveIdeaResult: async () => {
      try {
        // Many generate endpoints save automatically; but to be safe, attempt to re-send if incomplete.
        const last = STATE._lastGenerated;
        if (!last) {
          showMessage(nodes.generateIdeaMessage, 'Brak wygenerowanego przepisu do zapisania.');
          return;
        }
        // If last contains id or _id, we assume saved. Otherwise try create via POST /recipe (if exists).
        if (last._id || last.id) {
          showMessage(nodes.generateIdeaMessage, 'Przepis zapisany na serwerze.', 'success');
        } else {
          // fallback: send to /recipe (if backend expects); try POST /recipe with last as body
          try {
            await API.post('/recipe', last);
            showMessage(nodes.generateIdeaMessage, 'Przepis zapisany.', 'success');
          } catch (err) {
            showMessage(nodes.generateIdeaMessage, 'Nie udało się zapisać przepisu: ' + err.message);
          }
        }
        // refresh list
        await Handlers.fetchAndRenderRecipes();
      } catch (err) {
        showMessage(nodes.generateIdeaMessage, 'Błąd: ' + err.message);
      }
    },

    // Generate from ingredients (V2)
    handleGenerateIngredients: async (e) => {
      e.preventDefault();
      // collect ingredients into a single string, as API expects ingridientList: "<string>"
      const rows = Array.from(nodes.ingredientInputs.querySelectorAll('.ingredient-row'));
      if (!rows.length) {
        showMessage(nodes.generateIngredientsMessage, 'Dodaj przynajmniej jeden składnik.');
        return;
      }
      const parts = rows.map(row => {
        const name = row.querySelector('.ingredient-name').value.trim();
        const amount = row.querySelector('.ingredient-amount').value.trim();
        return amount ? `${name} (${amount})` : name;
      }).filter(Boolean);

      if (!parts.length) {
        showMessage(nodes.generateIngredientsMessage, 'Wprowadź poprawne składniki.');
        return;
      }

      const ingridientList = parts.join(', ');
      const maxTime = $('#ing-maxTime').value;
      const dificultyLevel = $('#ing-difficulty').value;
      const numberOfPortions = $('#ing-portions').value;

      try {
        showLoading('Generuję przepis (ze składników)...');
        const result = await Recipes.generateFromIngredients({ ingridientList, maxTime, dificultyLevel, numberOfPortions });
        nodes.ingredientsResultContent.innerHTML = prettyRecipeOutput(result);
        nodes.ingredientsResult.classList.remove('hidden');
        nodes.generateIngredientsForm.classList.add('hidden');
        STATE._lastGenerated = result;
      } catch (err) {
        // V2 may return 200 with AI can't produce; handle generically
        showMessage(nodes.generateIngredientsMessage, `Błąd generowania: ${err.message}`);
      } finally {
        hideLoading();
      }
    },

    handleSaveIngredientsResult: async () => {
      // same logic as idea save
      await Handlers.handleSaveIdeaResult();
    },

    handleUpdateProfile: async (e) => {
      e.preventDefault();
      const newEmail = $('#newEmail').value.trim();
      const newPassword = $('#newPassword').value;
      const newUsername = $('#newUsername').value.trim();

      const body = {};
      if (newEmail) body.newEmail = newEmail;
      if (newPassword) body.newPassword = newPassword;
      if (newUsername) body.newUsername = newUsername;

      if (Object.keys(body).length === 0) {
        showMessage(nodes.profileMessage, 'Brak zmian do zapisania.');
        return;
      }

      try {
        showLoading('Aktualizuję profil...');
        await User.updateProfile(body);
        showMessage(nodes.profileMessage, 'Profil zaktualizowany.', 'success');
        // refresh profile
        await User.fetchProfile();
      } catch (err) {
        showMessage(nodes.profileMessage, `Błąd aktualizacji: ${err.message}`);
      } finally {
        hideLoading();
      }
    },

    handleDeleteAccount: async (e) => {
      e.preventDefault();
      const password = $('#delete-password').value;
      if (!password) {
        showMessage(nodes.deleteMessage, 'Wprowadź swoje aktualne hasło.');
        return;
      }
      if (!confirm('Ta operacja usunie konto na stałe. Kontynuować?')) return;
      try {
        showLoading('Usuwam konto...');
        await User.deleteAccount(password);
        clearAuth();
        UI.updateNav();
        showMessage(nodes.loginMessage, 'Konto usunięte.', 'success');
        showView('login-view');
      } catch (err) {
        showMessage(nodes.deleteMessage, `Błąd usuwania konta: ${err.message}`);
      } finally {
        hideLoading();
      }
    },

    // Admin: fetch users list
    handleFetchUsersAdmin: async () => {
      if (!STATE.currentUser || STATE.currentUser.role !== 'Admin') {
        showMessage(nodes.adminMessage, 'Brak uprawnień admina.');
        return;
      }
      try {
        showLoading('Pobieram użytkowników...');
        const users = await Admin.listUsers();
        nodes.adminUserList.innerHTML = '';
        if (!Array.isArray(users) || users.length === 0) {
          nodes.adminUserList.innerHTML = '<div class="card">Brak użytkowników.</div>';
          return;
        }
        users.forEach(u => {
          const div = document.createElement('div');
          div.className = 'card';
          div.innerHTML = `<strong>${escapeHtml(u.username || u.name || '—')}</strong><div style="color:#999">${escapeHtml(u.email || '—')}</div>`;
          const actions = document.createElement('div');
          actions.className = 'actions';
          const btnView = document.createElement('button');
          btnView.className = 'btn ghost';
          btnView.textContent = 'Edytuj';
          btnView.addEventListener('click', async () => {
            try {
              showLoading('Pobieram dane użytkownika...');
              const userData = await Admin.getUser(u._id || u.id);
              // fill admin form
              $('#admin-edit-user-id').value = userData._id || userData.id;
              $('#admin-edit-email').value = userData.email || '';
              $('#admin-edit-username').value = userData.username || userData.name || '';
              $('#admin-edit-role').value = userData.role || 'User';
              nodes.adminEditContainer.classList.remove('hidden');
            } catch (err) {
              showMessage(nodes.adminMessage, 'Błąd: ' + err.message);
            } finally {
              hideLoading();
            }
          });
          const btnDelete = document.createElement('button');
          btnDelete.className = 'btn danger';
          btnDelete.textContent = 'Usuń';
          btnDelete.addEventListener('click', async () => {
            if (!confirm('Na pewno usunąć tego użytkownika?')) return;
            try {
              showLoading('Usuwam użytkownika...');
              await Admin.deleteUser(u._id || u.id);
              showMessage(nodes.adminMessage, 'Użytkownik usunięty.', 'success');
              await Handlers.handleFetchUsersAdmin();
            } catch (err) {
              showMessage(nodes.adminMessage, 'Błąd usuwania: ' + err.message);
            } finally {
              hideLoading();
            }
          });
          actions.appendChild(btnView);
          actions.appendChild(btnDelete);
          div.appendChild(actions);
          nodes.adminUserList.appendChild(div);
        });
      } catch (err) {
        showMessage(nodes.adminMessage, 'Błąd pobierania listy użytkowników: ' + err.message);
      } finally {
        hideLoading();
      }
    },

    handleAdminEditSave: async (e) => {
      e.preventDefault();
      const userId = $('#admin-edit-user-id').value;
      const email = $('#admin-edit-email').value.trim();
      const username = $('#admin-edit-username').value.trim();
      const newPassword = $('#admin-edit-newPassword').value;
      const role = $('#admin-edit-role').value;

      if (!userId || !email || !username) {
        showMessage(nodes.adminMessage, 'Uzupełnij wymagane pola.');
        return;
      }
      const body = {};
      body.newEmail = email;
      body.newUsername = username;
      if (newPassword) body.newPassword = newPassword;
      if (role) body.role = role;

      try {
        showLoading('Aktualizuję użytkownika...');
        await Admin.updateUser(userId, body);
        showMessage(nodes.adminMessage, 'Użytkownik zaktualizowany.', 'success');
        nodes.adminEditContainer.classList.add('hidden');
        await Handlers.handleFetchUsersAdmin();
      } catch (err) {
        showMessage(nodes.adminMessage, 'Błąd: ' + err.message);
      } finally {
        hideLoading();
      }
    }
  };

  // ---------- UI Helpers ----------
  const UIHelpers = {
    addIngredientInput: (name = '', amount = '') => {
      const container = nodes.ingredientInputs;
      const row = document.createElement('div');
      row.className = 'ingredient-row';
      row.innerHTML = `
        <input class="ingredient-name" placeholder="nazwa (np. marchew)" value="${escapeAttr(name)}">
        <input class="ingredient-amount" placeholder="ilość (np. 200g)" value="${escapeAttr(amount)}">
        <button type="button" title="Usuń">✕</button>
      `;
      const delBtn = row.querySelector('button');
      delBtn.addEventListener('click', () => {
        container.removeChild(row);
      });
      container.appendChild(row);
    }
  };

  // ---------- Small utilities ----------
  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escapeAttr(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/"/g, '&quot;');
  }
  function mapDifficulty(v) {
    if (v === 1 || v === '1') return 'Łatwy';
    if (v === 2 || v === '2') return 'Średni';
    if (v === 3 || v === '3') return 'Trudny';
    return v || '—';
  }

  // pretty printing recipe-like object
  function prettyRecipeOutput(obj) {
    // if obj contains recipe field, unwrap
    const data = obj.recipe || obj;
    const title = data.tytul || data.title || data.name || 'Brak tytułu';
    const description = data.opis || data.description || data.summary || '';
    const ingredients = data.skladniki || data.ingredients || [];
    const steps = data.instrukcje || data.steps || data.instructions || [];
    let html = `<h3>${escapeHtml(title)}</h3>`;
    if (description) html += `<p style="color:#999">${escapeHtml(description)}</p>`;
    if (Array.isArray(ingredients) && ingredients.length) {
      html += '<h4>Składniki</h4><ul>';
      ingredients.forEach(it => {
        html += `<li>${escapeHtml((it.ilosc || it.amount) || '')} ${escapeHtml((it.nazwa || it.name) || '')}</li>`;
      });
      html += '</ul>';
    }
    if (Array.isArray(steps) && steps.length) {
      html += '<h4>Instrukcje</h4><ol>';
      steps.forEach(s => {
        html += `<li>${escapeHtml(s.opis || s.description || s.text || s)}</li>`;
      });
      html += '</ol>';
    }
    return html;
  }

  // ---------- Initialize ----------
  document.addEventListener('DOMContentLoaded', () => {
    Handlers.init();
  });

})();
