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

    /* ─── Back to top ─── */
    var backToTop = document.querySelector('[data-back-to-top]');
    if (backToTop) {
        var toggleBackToTop = function () {
            backToTop.classList.toggle('is-visible', window.scrollY > 500);
        };
        toggleBackToTop();
        window.addEventListener('scroll', toggleBackToTop, { passive: true });
        backToTop.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
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

    /* ─── Glass showcase: 3D tilt ─── */
    var glassCard = document.querySelector('[data-tilt]');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (glassCard && window.matchMedia('(hover: hover)').matches && !reduceMotion) {
        glassCard.addEventListener('mousemove', function (event) {
            var rect = glassCard.getBoundingClientRect();
            var px = (event.clientX - rect.left) / rect.width - 0.5;
            var py = (event.clientY - rect.top) / rect.height - 0.5;
            var rotateY = px * 10;
            var rotateX = py * -10;
            glassCard.style.transform = 'perspective(1200px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';
        });
        glassCard.addEventListener('mouseleave', function () {
            glassCard.style.transform = 'perspective(1200px) rotateX(0) rotateY(0)';
        });
    }

    /* ─── Glass showcase: tab carousel with progress autoplay ─── */
    var glassCarousel = document.querySelector('[data-glass-carousel]');
    if (glassCarousel) {
        var gSlides = glassCarousel.querySelectorAll('[data-gslide]');
        var gTabs = glassCarousel.querySelectorAll('[data-gtab]');
        var gCurrent = 0;
        var gPaused = false;

        var gActivate = function (index) {
            gCurrent = (index + gSlides.length) % gSlides.length;
            gSlides.forEach(function (s, i) { s.classList.toggle('is-active', i === gCurrent); });
            gTabs.forEach(function (tab, i) {
                var isActive = i === gCurrent;
                tab.classList.toggle('is-active', isActive);
                var bar = tab.querySelector('.showcase-tab-progress i');
                if (bar) {
                    bar.style.animation = 'none';
                    // Force reflow so the animation restarts cleanly on the newly active tab.
                    void bar.offsetWidth;
                    bar.style.animation = '';
                    if (isActive) {
                        tab.style.setProperty('--tab-duration', (tab.dataset.duration || 5200) + 'ms');
                    }
                }
            });
        };

        gTabs.forEach(function (tab, i) {
            tab.addEventListener('click', function () { gActivate(i); });
            var bar = tab.querySelector('.showcase-tab-progress i');
            if (bar) {
                bar.addEventListener('animationend', function () {
                    if (i === gCurrent && !gPaused) gActivate(gCurrent + 1);
                });
            }
        });

        glassCarousel.addEventListener('mouseenter', function () {
            gPaused = true;
            gTabs.forEach(function (t) { t.classList.add('is-paused'); });
        });
        glassCarousel.addEventListener('mouseleave', function () {
            gPaused = false;
            gTabs.forEach(function (t) { t.classList.remove('is-paused'); });
        });

        gActivate(0);
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
