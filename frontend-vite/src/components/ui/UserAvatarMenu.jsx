// UserAvatarMenu.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

export default function UserAvatarMenu({
  isMobile,
  currentUser,
  currentAvatar,
  users = [],
  backendUrl,
  onSwitchUser,
  onLogout,
  onOpenSettings,
}) {
  const [open, setOpen] = useState(false);

  // HERO state: { src, baseRect, transform, phase, toRect? }
  const [hero, setHero] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const panelRef = useRef(null);
  const btnRef = useRef(null);
  const mainAvatarTargetRef = useRef(null);

  const navigate = useNavigate();

  const otherUsers = useMemo(() => {
    const curId = currentUser?.id;
    return (users || []).filter((u) => u?.id && u?.id !== curId);
  }, [users, currentUser]);

  const AvatarImg = React.memo(function AvatarImg({
    src,
    className = "",
    imgRef,
  }) {
    return (
      <div className={`uam__avatar-frame ${className}`} ref={imgRef}>
        {src ? (
          <img src={src} alt="" />
        ) : (
          <div className="uam__avatar-placeholder" />
        )}
      </div>
    );
  });

  const getRect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  };

  const makeTransform = (from, to) => {
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const sx = to.width / from.width;
    const sy = to.height / from.height;
    return `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
  };

  const hardClose = () => {
    setOpen(false);
    setHero(null);
    setIsAnimating(false);
  };

  const closeWithHeroToTrigger = () => {
    if (!open || isAnimating) return;

    const bigEl = mainAvatarTargetRef.current;
    const triggerEl = btnRef.current?.querySelector(".uam__avatar-frame");

    const fromRect = getRect(bigEl);
    const toRect = getRect(triggerEl);

    if (!fromRect || !toRect) {
      hardClose();
      return;
    }

    setIsAnimating(true);

    setHero({
      src: currentAvatar,
      baseRect: fromRect,
      transform: "translate3d(0,0,0) scale(1,1)",
      phase: "toTrigger",
      toRect,
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setHero((h) => {
          if (!h?.baseRect || !h?.toRect) return h;
          return { ...h, transform: makeTransform(h.baseRect, h.toRect) };
        });

        window.setTimeout(() => {
          hardClose();
        }, 520);
      });
    });
  };

  const openWithHeroToPanel = () => {
    if (open || isAnimating) return;

    const triggerEl = btnRef.current?.querySelector(".uam__avatar-frame");
    const fromRect = getRect(triggerEl);

    if (!fromRect) {
      setOpen(true);
      return;
    }

    setIsAnimating(true);

    setHero({
      src: currentAvatar,
      baseRect: fromRect,
      transform: "translate3d(0,0,0) scale(1,1)",
      phase: "toPanel",
    });

    setOpen(true);
  };

  // После открытия меню — меряем big avatar и запускаем полёт туда
  useEffect(() => {
    if (!open) return;
    if (!hero || hero.phase !== "toPanel") return;

    let raf1 = 0;
    let raf2 = 0;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const bigEl = mainAvatarTargetRef.current;
        const toRect = getRect(bigEl);

        if (!toRect || !hero.baseRect) {
          setIsAnimating(false);
          setHero(null);
          return;
        }

        const t = makeTransform(hero.baseRect, toRect);

        requestAnimationFrame(() => {
          setHero((h) => (h ? { ...h, transform: t } : h));

          window.setTimeout(() => {
            setIsAnimating(false);
            setHero(null);
          }, 520);
        });
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [open, hero]);

  // Desktop: закрытие кликом вне панели (capture)
  useEffect(() => {
    if (!open || isMobile) return;

    const onPointerDownCapture = (e) => {
      const t = e.target;
      if (panelRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      closeWithHeroToTrigger();
    };

    window.addEventListener("pointerdown", onPointerDownCapture, true);
    return () =>
      window.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, [open, isMobile, isAnimating, currentAvatar]);

  // Block scroll (mobile) + helper class for CSS
  useEffect(() => {
    if (open) document.documentElement.classList.add("uam-open");
    else document.documentElement.classList.remove("uam-open");

    if (isMobile && open) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }

    return () => document.documentElement.classList.remove("uam-open");
  }, [open, isMobile]);

  // Safety on resize
  useEffect(() => {
    const onResize = () => {
      setHero(null);
      setIsAnimating(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const heroStyle = hero?.baseRect
    ? {
        top: `${hero.baseRect.top}px`,
        left: `${hero.baseRect.left}px`,
        width: `${hero.baseRect.width}px`,
        height: `${hero.baseRect.height}px`,
        transform: hero.transform,
        transition:
          hero.phase === "toPanel" || hero.phase === "toTrigger"
            ? "transform 520ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease"
            : "none",
        opacity: 1,
      }
    : null;

  const portalNode =
    open || heroStyle
      ? createPortal(
          <div
            className={`uam-portal ${open ? "is-open" : ""} ${
              isAnimating ? "is-animating" : ""
            } ${isMobile ? "uam--mobile" : ""}`}
          >
            {/* Hero avatar */}
            {heroStyle && hero?.src && (
              <div
                className="uam__hero-avatar"
                style={heroStyle}
                aria-hidden="true"
              >
                <img src={hero.src} alt="" />
              </div>
            )}

            {/* Menu */}
            {open && (
              <div
                className={`uam__menu-container ${
                  isMobile ? "uam__menu-container--full" : ""
                }`}
              >
                {/* overlay (desktop) */}
                {!isMobile && (
                  <div
                    className="uam__overlay"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      closeWithHeroToTrigger();
                    }}
                  />
                )}

                <div ref={panelRef} className="uam__panel" role="menu">
                  {isMobile && (
                    <button
                      className="uam__mobile-close"
                      onClick={closeWithHeroToTrigger}
                      aria-label="Close"
                      type="button"
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}

                  <div className="uam__content">
                    <div className="uam__section uam__section--current">
                      <AvatarImg
                        src={currentAvatar}
                        className={`uam__main-avatar ${
                          isAnimating ? "is-hero-target" : ""
                        }`}
                        imgRef={mainAvatarTargetRef}
                      />
                      <div className="uam__main-info">
                        <h2 className="uam__user-name">{currentUser?.name}</h2>
                      </div>
                    </div>

                    {otherUsers.length > 0 && (
                      <div className="uam__section">
                        <div className="uam__grid">
                          {otherUsers.map((u) => (
                            <button
                              key={u.id}
                              className="uam__user-item"
                              type="button"
                              onClick={() => {
                                onSwitchUser?.(u);
                                closeWithHeroToTrigger();
                              }}
                            >
                              <AvatarImg
                                src={
                                  u?.avatar_url
                                    ? `${backendUrl}${u.avatar_url}`
                                    : ""
                                }
                                className="uam__item-avatar"
                              />
                              <span className="uam__item-name">{u?.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="uam__section uam__section--actions">
                      <button
                        className="uam__action-link"
                        type="button"
                        onClick={() => {
                          onOpenSettings?.();
                          closeWithHeroToTrigger();
                        }}
                      >
                        <span>Налаштування</span>
                      </button>

                      <button
                        className="uam__action-link"
                        type="button"
                        onClick={() => {
                          navigate("/liked");
                          closeWithHeroToTrigger();
                        }}
                      >
                        <span>Вподобані</span>
                      </button>

                      <button
                        className="uam__action-link"
                        type="button"
                        onClick={() => {
                          navigate("/connect");
                          closeWithHeroToTrigger();
                        }}
                      >
                        <span>Підключення телевізора</span>
                      </button>

                      <button
                        className="uam__action-link uam__action-link--danger"
                        type="button"
                        onClick={() => {
                          onLogout?.();
                          closeWithHeroToTrigger();
                        }}
                      >
                        <span>Вийти з акаунту</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className={`uam ${open ? "is-open" : ""} ${
        isAnimating ? "is-animating" : ""
      }`}
    >
      <button
        ref={btnRef}
        type="button"
        className="uam__trigger"
        onClick={() => {
          if (open) closeWithHeroToTrigger();
          else openWithHeroToPanel();
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <AvatarImg src={currentAvatar} className="uam__trigger-avatar" />
      </button>

      {portalNode}
    </div>
  );
}
