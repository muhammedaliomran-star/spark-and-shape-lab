import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { getStorefrontNotifications, markStorefrontNotificationRead, type StorefrontNotification } from "@/lib/storefront";

export function StorefrontNotificationBell() {
  const [items, setItems] = useState<StorefrontNotification[]>([]);
  const [open, setOpen] = useState(false);
  const load = async () => { try { setItems(await getStorefrontNotifications()); } catch { setItems([]); } };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 60000); return () => window.clearInterval(timer); }, []);
  const unread = items.filter((item) => !item.read_at).length;
  const read = async (item: StorefrontNotification) => { if (item.read_at) return; await markStorefrontNotificationRead(item.id); setItems((current) => current.map((value) => value.id === item.id ? { ...value, read_at: new Date().toISOString() } : value)); };
  return <div className="relative"><button type="button" aria-label="إشعارات المتجر" onClick={() => setOpen((value) => !value)} className="relative grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"><Bell className="h-5 w-5" />{unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread}</span>}</button>{open && <div className="absolute left-0 top-12 z-50 w-80 rounded-2xl border border-border bg-card p-3 shadow-2xl" dir="rtl"><div className="mb-2 flex items-center justify-between"><strong>إشعارات المتجر</strong><span className="text-xs text-muted-foreground">{unread} جديد</span></div>{items.length === 0 ? <p className="p-5 text-center text-sm text-muted-foreground">مفيش إشعارات جديدة</p> : <div className="grid gap-1">{items.slice(0, 8).map((item) => <button key={item.id} type="button" onClick={() => void read(item)} className={`rounded-xl p-3 text-right hover:bg-muted ${item.read_at ? "opacity-60" : "bg-primary/5"}`}><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.body}</p></div>{!item.read_at && <Check className="h-4 w-4 shrink-0 text-primary" />}</div></button>)}</div>}</div>}</div>;
}
