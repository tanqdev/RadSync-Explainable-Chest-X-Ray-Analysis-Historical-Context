import { Link, useRouterState } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { Activity, ArrowUpRight, ChevronLeft, ChevronRight, FlaskConical, History, LayoutDashboard, Menu, ScanLine, X, Info, CircleHelp, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReadyStatus } from './Common';
const navigation = [{ label: 'Dashboard', to: '/', icon: LayoutDashboard }, { label: 'Analyze X-Ray', to: '/analyze', icon: ScanLine }, { label: 'History', to: '/history', icon: History }, { label: 'About', to: '/about', icon: Info }] as const;
export function AppLayout({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const title = path.startsWith('/results') ? 'Analysis Results' : navigation.find((item) => item.to === path)?.label ?? 'Dashboard';
  return <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    {mobileOpen && <div className="mobile-scrim" onClick={() => setMobileOpen(false)} />}
    <aside className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <Link to="/" className="brand" onClick={() => setMobileOpen(false)}><span className="brand-symbol"><Activity size={25} strokeWidth={2.2} /></span><span className="brand-name">Thorax<span>AI</span><small>CHEST IMAGING INTELLIGENCE</small></span></Link>
      <Button variant="ghost" size="icon" className="mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X /></Button>
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="Main navigation">{navigation.map(({ label, to, icon: Icon }) => <Link key={to} to={to} onClick={() => setMobileOpen(false)} className={`nav-item ${path === to || (to === '/analyze' && path.startsWith('/results')) ? 'active' : ''}`} title={collapsed ? label : undefined}><Icon size={19} /><span>{label}</span>{label === 'Analyze X-Ray' && <ChevronRight size={15} className="nav-arrow" />}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="research-label"><FlaskConical size={18} /><span>AI Research Prototype<small>Built for discovery, not diagnosis.</small></span></div><ReadyStatus /><div className="sidebar-version"><span>ThoraxAI v1.0</span><span>DEMO</span></div></div>
    </aside>
    <div className="app-main"><header className="top-header"><div className="header-left"><Button variant="ghost" size="icon" aria-label="Toggle navigation" onClick={() => { setCollapsed(!collapsed); setMobileOpen(!mobileOpen); }}><PanelLeftClose className="desktop-toggle" /><Menu className="mobile-toggle" /></Button><span className="header-workspace">Workspace</span><ChevronRight size={14} className="text-muted-foreground" /><span className="header-title">{title}</span></div><div className="header-right"><ReadyStatus /><span className="header-divider" /><Button variant="ghost" size="icon" aria-label="Research information" onClick={() => setHelpOpen(true)}><CircleHelp size={19} /></Button><span className="research-avatar" title="Research workspace">R</span></div></header>
      <main className="page-content">{children}</main><footer className="app-footer"><span>© 2026 ThoraxAI · Research & educational use only</span><span><FlaskConical size={12} /> University research prototype</span></footer>
    </div>
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent><DialogHeader><DialogTitle>ThoraxAI research workspace</DialogTitle><DialogDescription>All predictions, statistics, retrieved cases, and attention maps are illustrative demonstration data. Images are processed only within this browser; no files are sent to a server. Uploaded analyses remain available for this session only.</DialogDescription></DialogHeader><Button asChild variant="outline"><Link to="/about" onClick={() => setHelpOpen(false)}>About the project<ArrowUpRight /></Link></Button></DialogContent></Dialog>
  </div>;
}
