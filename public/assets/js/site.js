(function () {
    'use strict';

    /* ─── Header scroll state ─── */
    var header = document.querySelector('[data-site-header]');
    if (header) {
        var onScroll = function () {
            header.classList.toggle('is-scrolled', window.scrollY > 12);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    /* ─── Mobile nav toggle ─── */
    var navToggle = document.querySelector('[data-nav-toggle]');
    var nav = document.querySelector('[data-site-nav]');
    if (navToggle && nav) {
        navToggle.addEventListener('click', function () {
            nav.classList.toggle('is-open');
        });
        nav.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                nav.classList.remove('is-open');
            });
        });
    }

    /* ─── Reveal on scroll ─── */
    var revealEls = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && revealEls.length) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
        revealEls.forEach(function (el) { observer.observe(el); });
    } else {
        revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    }

    /* ─── Hero particles ─── */
    var particleField = document.querySelector('[data-particles]');
    if (particleField) {
        var count = window.innerWidth < 640 ? 10 : 20;
        for (var i = 0; i < count; i++) {
            var p = document.createElement('span');
            p.className = 'hero-particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.top = 40 + Math.random() * 55 + '%';
            p.style.animationDuration = (7 + Math.random() * 8) + 's';
            p.style.animationDelay = (Math.random() * 8) + 's';
            particleField.appendChild(p);
        }
    }

    /* ─── Hero cursor-reactive spotlight ─── */
    var hero = document.querySelector('[data-hero]');
    var spotlight = document.querySelector('[data-spotlight]');
    if (hero && spotlight && window.matchMedia('(hover: hover)').matches) {
        hero.addEventListener('mousemove', function (event) {
            var rect = hero.getBoundingClientRect();
            var mx = ((event.clientX - rect.left) / rect.width) * 100;
            var my = ((event.clientY - rect.top) / rect.height) * 100;
            spotlight.style.setProperty('--mx', mx + '%');
            spotlight.style.setProperty('--my', my + '%');
        });
    }

    /* ─── Contact form ─── */
    var form = document.querySelector('[data-contact-form]');
    if (form) {
        var feedback = form.querySelector('[data-form-feedback]');
        var submitBtn = form.querySelector('[data-submit-btn]');

        var showFeedback = function (type, message) {
            if (!feedback) return;
            feedback.textContent = message;
            feedback.className = 'form-feedback is-visible ' + type;
        };

        var clearErrors = function () {
            form.querySelectorAll('.form-group').forEach(function (g) { g.classList.remove('has-error'); });
            form.querySelectorAll('[data-field-error]').forEach(function (e) { e.textContent = ''; });
        };

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            clearErrors();

            var honeypot = form.querySelector('input[name="website"]');
            if (honeypot && honeypot.value) {
                showFeedback('success', 'Mensagem enviada! Em breve entramos em contato.');
                form.reset();
                return;
            }

            submitBtn.setAttribute('disabled', 'disabled');
            var originalLabel = submitBtn.textContent;
            submitBtn.textContent = 'Enviando...';

            fetch(form.action, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: new FormData(form),
            })
                .then(function (response) {
                    if (response.status === 422) {
                        return response.json().then(function (data) { throw { validation: data.errors }; });
                    }
                    if (!response.ok) throw new Error('request-failed');
                    return response.json();
                })
                .then(function () {
                    showFeedback('success', 'Mensagem enviada! Em breve entramos em contato.');
                    form.reset();
                })
                .catch(function (err) {
                    if (err && err.validation) {
                        Object.keys(err.validation).forEach(function (field) {
                            var group = form.querySelector('[data-field="' + field + '"]');
                            if (group) {
                                group.classList.add('has-error');
                                var errEl = group.querySelector('[data-field-error]');
                                if (errEl) errEl.textContent = err.validation[field][0];
                            }
                        });
                        showFeedback('error', 'Confira os campos destacados e tente novamente.');
                    } else {
                        showFeedback('error', 'Nao foi possivel enviar agora. Tente novamente ou chame no WhatsApp.');
                    }
                })
                .finally(function () {
                    submitBtn.removeAttribute('disabled');
                    submitBtn.textContent = originalLabel;
                });
        });
    }
})();
