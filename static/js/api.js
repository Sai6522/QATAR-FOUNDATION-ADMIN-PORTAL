/**
 * api.js — wires the existing admin.js forms to the Flask backend.
 * admin.js is left untouched; this file overrides the form submit listeners
 * that were registered there by re-attaching them with cloneNode (removes old
 * listeners) and adding new ones that call the API then delegate to the
 * original UI behaviour.
 */

(function () {
    'use strict';

    // ── helpers ──────────────────────────────────────────────────────────────

    async function apiPost(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return { ok: res.ok, status: res.status, data: await res.json() };
    }

    async function apiRequest(method, url, body) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        return { ok: res.ok, status: res.status, data: await res.json() };
    }

    function replaceForm(id) {
        const old = document.getElementById(id);
        if (!old) return null;
        const fresh = old.cloneNode(true);
        old.parentNode.replaceChild(fresh, old);
        return fresh;
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    const loginForm = replaceForm('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value.trim();
            const captchaInput = document.getElementById('loginCaptchaInput').value.trim();

            // client-side captcha check (kept from admin.js logic)
            if (!captchaInput || captchaInput !== captchas.login) {
                showError('loginCaptchaErr', 'Captcha does not match. Please try again.');
                generateCaptcha('login');
                return;
            }

            const { ok, data } = await apiPost('/api/login', { email, password });
            if (!ok) {
                showError('loginPasswordErr', data.error || 'Invalid email or password');
                shakeForm('loginForm');
                generateCaptcha('login');
                return;
            }

            showToast('Login successful! Redirecting...');
            generateCaptcha('login');
            setTimeout(() => showDashboard(email), 1200);
        });
    }

    // ── Signup ────────────────────────────────────────────────────────────────

    const signupForm = replaceForm('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const full_name = document.getElementById('signupName').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const password = document.getElementById('signupPassword').value.trim();
            const confirm_password = document.getElementById('signupConfirmPassword').value.trim();
            const captchaInput = document.getElementById('signupCaptchaInput').value.trim();

            if (!captchaInput || captchaInput !== captchas.signup) {
                showError('signupCaptchaErr', 'Captcha does not match.');
                generateCaptcha('signup');
                return;
            }

            const { ok, data } = await apiPost('/api/signup', { full_name, email, password, confirm_password });
            if (!ok) {
                showError('signupEmailErr', data.error || 'Signup failed');
                shakeForm('signupForm');
                generateCaptcha('signup');
                return;
            }

            showToast('Account created successfully!');
            generateCaptcha('signup');
            this.reset();
            checkStrength('');
            setTimeout(() => showPage('loginPage'), 1500);
        });
    }

    // ── Forgot Password ───────────────────────────────────────────────────────

    const forgotForm = replaceForm('forgotForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const email = document.getElementById('forgotEmail').value.trim();
            const captchaInput = document.getElementById('forgotCaptchaInput').value.trim();

            if (!captchaInput || captchaInput !== captchas.forgot) {
                showError('forgotCaptchaErr', 'Captcha does not match.');
                generateCaptcha('forgot');
                return;
            }

            await apiPost('/api/forgot-password', { email });
            // Always show success (prevents email enumeration)
            showToast('Reset link sent to your email!');
            generateCaptcha('forgot');
            this.reset();
        });
    }

    // ── Opportunity Form ──────────────────────────────────────────────────────

    const oppForm = replaceForm('opportunityForm');
    if (oppForm) {
        oppForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const name = document.getElementById('oppName').value.trim();
            const duration = document.getElementById('oppDuration').value.trim();
            const start_date = document.getElementById('oppStartDate').value;
            const description = document.getElementById('oppDescription').value.trim();
            const skillsRaw = document.getElementById('oppSkills').value.trim();
            const category = document.getElementById('oppCategory').value;
            const future_opportunities = document.getElementById('oppFuture').value.trim();
            const maxApplicants = document.getElementById('oppMaxApplicants').value.trim();

            if (!name || !duration || !start_date || !description || !skillsRaw || !category || !future_opportunities) {
                showToast('Please fill all required fields');
                return;
            }

            const skills = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);
            const payload = {
                name, duration, start_date, description,
                skills, category, future_opportunities,
                max_applicants: maxApplicants ? parseInt(maxApplicants, 10) : null,
            };

            const { ok, data } = await apiRequest('POST', '/api/opportunities', payload);
            if (!ok) {
                showToast(data.error || 'Failed to create opportunity');
                return;
            }

            // Build and append the card (mirrors admin.js UI logic)
            const opp = data.data;
            const card = document.createElement('div');
            card.className = 'opportunity-card';
            card.dataset.id = opp.id;

            const applicantsCount = opp.max_applicants ? `${opp.max_applicants} applicants` : '0 applicants';
            card.innerHTML = `
                <div class="opportunity-card-header">
                    <h5>${escapeHtml(opp.name)}</h5>
                    <div class="opportunity-meta">
                        <span>${escapeHtml(opp.duration)}</span>
                        <span>${escapeHtml(opp.start_date)}</span>
                    </div>
                </div>
                <p class="opportunity-description">${escapeHtml(opp.description)}</p>
                <div class="opportunity-skills">
                    <div class="opportunity-skills-label">Skills You'll Gain</div>
                    <div class="skills-tags">
                        ${opp.skills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}
                    </div>
                </div>
                <div class="opportunity-footer">
                    <span class="applicants-count">${escapeHtml(applicantsCount)}</span>
                    <button class="view-course-btn" style="width:auto;padding:8px 16px;">View Details</button>
                    <button class="delete-opp-btn" data-id="${opp.id}" style="width:auto;padding:8px 12px;background:#e74c3c;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-left:6px;">Delete</button>
                </div>`;

            card.querySelector('.view-course-btn').addEventListener('click', () => {
                openOpportunityDetails(opp.name, {
                    duration: opp.duration,
                    startDate: opp.start_date,
                    description: opp.description,
                    skills: opp.skills,
                    applicants: opp.max_applicants || 0,
                    futureOpportunities: opp.future_opportunities,
                    prerequisites: '',
                });
            });

            card.querySelector('.delete-opp-btn').addEventListener('click', async () => {
                if (!confirm('Delete this opportunity?')) return;
                const { ok: delOk } = await apiRequest('DELETE', `/api/opportunities/${opp.id}`);
                if (delOk) { card.remove(); showToast('Opportunity deleted'); }
                else showToast('Failed to delete opportunity');
            });

            const grid = document.querySelector('.opportunities-grid');
            if (grid) grid.appendChild(card);

            showToast('Opportunity created successfully!');
            closeOpportunityModal();
            this.reset();
        });
    }

    // ── Load opportunities on dashboard open ──────────────────────────────────

    const origShowDashboard = window.showDashboard;
    window.showDashboard = function (email) {
        origShowDashboard(email);
        loadOpportunities();
    };

    async function loadOpportunities() {
        const { ok, data } = await apiRequest('GET', '/api/opportunities');
        if (!ok || !data.data) return;
        const grid = document.querySelector('.opportunities-grid');
        if (!grid) return;

        data.data.forEach(opp => {
            // skip if card already exists (e.g. static demo cards)
            if (grid.querySelector(`[data-id="${opp.id}"]`)) return;

            const card = document.createElement('div');
            card.className = 'opportunity-card';
            card.dataset.id = opp.id;
            const applicantsCount = opp.max_applicants ? `${opp.max_applicants} applicants` : '0 applicants';
            card.innerHTML = `
                <div class="opportunity-card-header">
                    <h5>${escapeHtml(opp.name)}</h5>
                    <div class="opportunity-meta">
                        <span>${escapeHtml(opp.duration)}</span>
                        <span>${escapeHtml(opp.start_date)}</span>
                    </div>
                </div>
                <p class="opportunity-description">${escapeHtml(opp.description)}</p>
                <div class="opportunity-skills">
                    <div class="opportunity-skills-label">Skills You'll Gain</div>
                    <div class="skills-tags">
                        ${opp.skills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}
                    </div>
                </div>
                <div class="opportunity-footer">
                    <span class="applicants-count">${escapeHtml(applicantsCount)}</span>
                    <button class="view-course-btn" style="width:auto;padding:8px 16px;">View Details</button>
                    <button class="delete-opp-btn" data-id="${opp.id}" style="width:auto;padding:8px 12px;background:#e74c3c;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-left:6px;">Delete</button>
                </div>`;

            card.querySelector('.view-course-btn').addEventListener('click', () => {
                openOpportunityDetails(opp.name, {
                    duration: opp.duration, startDate: opp.start_date,
                    description: opp.description, skills: opp.skills,
                    applicants: opp.max_applicants || 0,
                    futureOpportunities: opp.future_opportunities, prerequisites: '',
                });
            });

            card.querySelector('.delete-opp-btn').addEventListener('click', async () => {
                if (!confirm('Delete this opportunity?')) return;
                const { ok: delOk } = await apiRequest('DELETE', `/api/opportunities/${opp.id}`);
                if (delOk) { card.remove(); showToast('Opportunity deleted'); }
                else showToast('Failed to delete opportunity');
            });

            grid.appendChild(card);
        });
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    const origHandleLogout = window.handleLogout;
    window.handleLogout = async function () {
        await apiPost('/api/logout', {});
        origHandleLogout();
    };

})();
