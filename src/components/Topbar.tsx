"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { signOut, useSession } from "next-auth/react";
import { OfflineChip } from "@/components/OfflineChip";
import { NavBarShimmer, ShimmerBlock } from "@/components/PageShimmer";
import { canManage, isSuperuser } from "@/lib/access";
import { passwordPolicyError } from "@/lib/password-policy";
import { useSheetYear, yearChoices } from "@/lib/sheet-year";
import { userPhotoPublicUrl } from "@/lib/user-photo-url";

type Copy = {
  refresh: string;
  menu: string;
  account: string;
  profile: string;
  password: string;
  logout: string;
  light: string;
  dark: string;
  name: string;
  save: string;
  cancel: string;
  current: string;
  next: string;
  confirm: string;
  mismatch: string;
  saved: string;
};

const text: Copy = {
  refresh: "Muat ulang",
  menu: "Menu",
  account: "Menu akun",
  profile: "Edit profil",
  password: "Ubah password",
  logout: "Logout",
  light: "Tema terang",
  dark: "Tema gelap",
  name: "Nama",
  save: "Simpan",
  cancel: "Batal",
  current: "Password sekarang",
  next: "Password baru",
  confirm: "Ulangi password baru",
  mismatch: "Password baru tidak sama",
  saved: "Tersimpan.",
};

type Props = {
  busy?: boolean;
  onRefresh: () => void;
};

function YearFilter() {
  const year = useSheetYear((state) => state.year);
  const setYear = useSheetYear((state) => state.setYear);
  const [ready, setReady] = useState(false);
  const yearsQuery = useQuery({
    queryKey: ["dt-summary", year],
    queryFn: async () => {
      const response = await fetch(`/api/summary?year=${year}`);
      if (!response.ok) throw new Error("Gagal memuat tahun");
      return (await response.json()) as { years?: number[] };
    },
    enabled: ready,
  });

  useEffect(() => {
    void Promise.resolve(useSheetYear.persist.rehydrate()).then(() => setReady(true));
  }, []);

  return (
    <select
      className="year-filter nav-year"
      aria-label="Tahun"
      value={year}
      onChange={(event) => setYear(event.target.value)}
    >
      {yearChoices(year, yearsQuery.data?.years || []).map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </select>
  );
}

function shortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name;
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function levelLabel(level: string) {
  if (!level) return "";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function Topbar({ busy = false, onRefresh }: Props) {
  const { data, update } = useSession();
  const [light, setLight] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [sheetAccountOpen, setSheetAccountOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [dialog, setDialog] = useState<"profile" | "password" | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const sessionRef = useRef<HTMLDivElement>(null);
  const topbarRef = useRef<HTMLElement>(null);
  const name = data?.user?.name || data?.user?.email || "Pengguna";
  const level = levelLabel(data?.user?.level || "");
  const avatarUrl = userPhotoPublicUrl(data?.user?.photo_name || "");
  const superuser = isSuperuser(data?.user?.level);
  const writer = canManage(data?.user?.level);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    setLight(document.documentElement.getAttribute("data-theme") === "light");
  }, []);

  useEffect(() => {
    if (!busy) return;
    setNavOpen(false);
    setSessionOpen(false);
    setSheetAccountOpen(false);
  }, [busy]);

  useEffect(() => {
    document.documentElement.classList.toggle("menu-open", navOpen);
    return () => {
      document.documentElement.classList.remove("menu-open");
    };
  }, [navOpen]);

  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return;
    const sync = () => {
      document.documentElement.style.setProperty("--topbar-height", `${el.offsetHeight}px`);
      document.documentElement.classList.toggle("topbar-scrolled", window.scrollY > 4);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    if (!sessionOpen) return;
    function place() {
      const box = sessionRef.current?.getBoundingClientRect();
      if (!box) return;
      setMenuPos({
        top: Math.round(box.bottom + 6),
        right: Math.round(window.innerWidth - box.right),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
    };
  }, [sessionOpen]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      const menu = document.getElementById("nav-session-menu");
      if ((target as Element).closest?.(".session-sheet-backdrop")) {
        setSessionOpen(false);
        return;
      }
      if (menu?.contains(target)) return;
      if (sessionRef.current && !sessionRef.current.contains(target)) setSessionOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSessionOpen(false);
        setSheetAccountOpen(false);
        setNavOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function toggleTheme() {
    const next = light ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("tu-rental-theme", next);
    setLight(next === "light");
  }

  function closeMenu() {
    setNavOpen(false);
    setSessionOpen(false);
    setSheetAccountOpen(false);
  }

  const manageLinks = (
    <>
      <Link className="nav-manage-item" role="menuitem" href="/daftar" onClick={closeMenu}>
        Daftar unit
      </Link>
      <Link className="nav-manage-item" role="menuitem" href="/master/model" onClick={closeMenu}>
        Master model
      </Link>
      <Link className="nav-manage-item" role="menuitem" href="/master/group" onClick={closeMenu}>
        Master group
      </Link>
      <Link className="nav-manage-item" role="menuitem" href="/master/unit" onClick={closeMenu}>
        Master unit
      </Link>
      {writer ? (
        <Link className="nav-manage-item" role="menuitem" href="/backup" onClick={closeMenu}>
          Backup data
        </Link>
      ) : null}
      {superuser ? (
        <Link className="nav-manage-item" role="menuitem" href="/pengguna" onClick={closeMenu}>
          Pengguna
        </Link>
      ) : null}
    </>
  );

  return (
    <>
      <div className="topbar-glass" />
      <header className="topbar" ref={topbarRef}>
        <div className="brand-row">
          <Link className="brand-lockup" href="/" aria-label="Halaman utama">
            <img className="brand-logo" src="/trakindo-cat.png" alt="" suppressHydrationWarning />
            <span className="brand-divider" aria-hidden="true" />
            <span className="brand-text">
              <span className="brand">ARMOR</span>
              <span className="brand-tagline">Asset Readiness &amp; Monitoring of Operational Repair</span>
            </span>
          </Link>
          {busy ? <ShimmerBlock className="shimmer-block--offline-chip" /> : <OfflineChip />}
        </div>
        <div className="top-actions">
          {busy ? (
            <NavBarShimmer label="Memuat…" />
          ) : (
            <>
              <div className="top-actions-panel top-actions-panel--bar">
                <div className="nav-tools">
                  <YearFilter />
                  <button
                    className="btn btn-icon"
                    type="button"
                    disabled={busy}
                    aria-label={text.refresh}
                    title={text.refresh}
                    onClick={onRefresh}
                  >
                    <RefreshIcon />
                  </button>
                  <button
                    className="btn btn-icon"
                    type="button"
                    aria-label={light ? text.dark : text.light}
                    title={light ? text.dark : text.light}
                    onClick={toggleTheme}
                  >
                    {light ? <MoonIcon /> : <SunIcon />}
                  </button>
                </div>
                <div className="nav-end">
                  <div className={`nav-session-menu${sessionOpen ? " is-open" : ""}`} ref={sessionRef}>
                    <button
                      className="btn nav-account"
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={sessionOpen}
                      aria-label={text.account}
                      title={`${name} · ${level}`}
                      onClick={() => setSessionOpen((open) => !open)}
                    >
                      <span className="nav-user">
                        <span className="nav-user-name">{shortName(name)}</span>
                        <span className="nav-user-level">{level}</span>
                      </span>
                      <AccountAvatar url={avatarUrl} size={28} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="top-actions-mobile">
                <button
                  className="btn btn-icon"
                  type="button"
                  disabled={busy}
                  aria-label={text.refresh}
                  title={text.refresh}
                  onClick={onRefresh}
                >
                  <RefreshIcon />
                </button>
                <button
                  className={`btn btn-icon nav-burger${navOpen ? " is-on" : ""}`}
                  type="button"
                  aria-label={navOpen ? "Tutup menu" : text.menu}
                  aria-expanded={navOpen}
                  onClick={() => {
                    setSessionOpen(false);
                    setSheetAccountOpen(false);
                    setNavOpen((open) => !open);
                  }}
                >
                  <BurgerIcon open={navOpen} />
                </button>
              </div>
            </>
          )}
        </div>
      </header>
      {navOpen && portalReady
        ? createPortal(
            <>
              <div
                className="top-menu-backdrop"
                onClick={closeMenu}
                aria-hidden="true"
              />
              <div
                className="top-actions-panel top-actions-panel--float is-open"
                role="dialog"
                aria-label={text.menu}
              >
                <div className="nav-sheet-handle" aria-hidden="true" />
                <div className="nav-sheet-profile-row">
                  <button
                    type="button"
                    className="nav-user nav-user--menu nav-user--menu-btn"
                    title={`${name} · ${level}`}
                    aria-haspopup="dialog"
                    aria-expanded={sheetAccountOpen}
                    aria-label={text.account}
                    onClick={() => setSheetAccountOpen(true)}
                  >
                    <AccountAvatar url={avatarUrl} size={44} />
                    <span className="nav-user-text">
                      <span className="nav-user-name">{name}</span>
                      <span className="nav-user-level">{level}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-icon nav-sheet-logout"
                    aria-label={text.logout}
                    title={text.logout}
                    onClick={() => {
                      closeMenu();
                      void signOut({ callbackUrl: "/sign-in" });
                    }}
                  >
                    <LogoutIcon />
                  </button>
                </div>
                <p className="nav-menu-label">Tampilan</p>
                <div className="nav-menu-prefs">
                  <YearFilter />
                  <button
                    className="btn btn-icon"
                    type="button"
                    onClick={toggleTheme}
                    aria-label={light ? text.dark : text.light}
                    title={light ? text.dark : text.light}
                  >
                    {light ? <MoonIcon /> : <SunIcon />}
                  </button>
                </div>
                <p className="nav-menu-label">Kelola</p>
                <div className="nav-sheet-list" role="menu">
                  {manageLinks}
                </div>
              </div>
              {sheetAccountOpen ? (
                <div
                  className="nav-sheet-account-backdrop"
                  onClick={() => setSheetAccountOpen(false)}
                >
                  <div
                    className="nav-sheet-account-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Akun"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="nav-sheet-account-head">
                      <strong>Akun</strong>
                      <button
                        type="button"
                        className="btn btn-icon"
                        aria-label="Tutup"
                        onClick={() => setSheetAccountOpen(false)}
                      >
                        ×
                      </button>
                    </div>
                    <button
                      type="button"
                      className="nav-sheet-item"
                      onClick={() => {
                        closeMenu();
                        setDialog("profile");
                      }}
                    >
                      {text.profile}
                    </button>
                    <button
                      type="button"
                      className="nav-sheet-item"
                      onClick={() => {
                        closeMenu();
                        setDialog("password");
                      }}
                    >
                      {text.password}
                    </button>
                  </div>
                </div>
              ) : null}
            </>,
            document.body
          )
        : null}
      {sessionOpen && menuPos
        ? createPortal(
            <>
              <button
                className="sheet-backdrop session-sheet-backdrop"
                type="button"
                aria-label="Tutup"
                onClick={() => setSessionOpen(false)}
              />
              <div
                id="nav-session-menu"
                className="nav-manage-menu nav-session-portal-menu"
                role="menu"
                style={{ top: menuPos.top, right: menuPos.right }}
              >
                <p className="sheet-title">Akun</p>
                <button
                  type="button"
                  role="menuitem"
                  className="nav-manage-item"
                  onClick={() => {
                    setSessionOpen(false);
                    setDialog("profile");
                  }}
                >
                  {text.profile}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="nav-manage-item"
                  onClick={() => {
                    setSessionOpen(false);
                    setDialog("password");
                  }}
                >
                  {text.password}
                </button>
                {superuser ? (
                  <Link className="nav-manage-item" role="menuitem" href="/pengguna" onClick={() => setSessionOpen(false)}>
                    Pengguna
                  </Link>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="nav-manage-item"
                  onClick={() => signOut({ callbackUrl: "/sign-in" })}
                >
                  {text.logout}
                </button>
              </div>
            </>,
            document.body
          )
        : null}
      {dialog ? (
        <AccountDialog
          mode={dialog}
          text={text}
          initialName={data?.user?.name || ""}
          onClose={() => setDialog(null)}
          onNameSaved={async (nextName) => {
            await update({ name: nextName });
          }}
        />
      ) : null}
    </>
  );
}

function AccountDialog({
  mode,
  text,
  initialName,
  onClose,
  onNameSaved,
}: {
  mode: "profile" | "password";
  text: Copy;
  initialName: string;
  onClose: () => void;
  onNameSaved: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (mode === "password") {
      const policyError = passwordPolicyError(newPassword);
      if (policyError) {
        setError(policyError);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError(text.mismatch);
        return;
      }
    }
    setPending(true);
    try {
      const response = await fetch(
        mode === "profile" ? "/api/account/profile" : "/api/account/password",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            mode === "profile"
              ? { name }
              : { currentPassword, newPassword }
          ),
        }
      );
      const body = (await response.json().catch(() => null)) as { error?: string; name?: string } | null;
      if (!response.ok) {
        setError(body?.error || "Gagal menyimpan");
        return;
      }
      if (mode === "profile") await onNameSaved(body?.name || name);
      setNotice(text.saved);
      if (mode === "password") onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="nav-dialog-backdrop" onMouseDown={onClose}>
      <form
        className="nav-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <h2>{mode === "profile" ? text.profile : text.password}</h2>
        {mode === "profile" ? (
          <label>
            {text.name}
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
        ) : (
          <>
            <label>
              {text.current}
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </label>
            <label>
              {text.next}
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </label>
            <label>
              {text.confirm}
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </label>
          </>
        )}
        {error ? <div className="error">{error}</div> : null}
        {notice ? <div className="notice">{notice}</div> : null}
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {text.save}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            {text.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.1-5.7" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function AccountAvatar({ url, size = 28 }: { url: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [url]);
  const glyph = Math.max(14, Math.round(size * 0.55));
  if (!url || failed) {
    return (
      <span
        className="nav-avatar"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </span>
    );
  }
  return (
    <img
      className="nav-avatar"
      src={url}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
    />
  );
}
