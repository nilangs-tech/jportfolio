"use client";

export function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <>
      <div className="header">
        <div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
        <a className="tool-link" href="/">← Dashboard</a>
      </div>
      {children}
    </>
  );
}

export function HostedNotice({ feature }: { feature: string }) {
  return (
    <Shell title={feature} subtitle="">
      <div className="mode-banner mode-hosted">
        🌐 {feature} is a local-only feature and is disabled on the hosted dashboard. Run the local app to use it.
      </div>
    </Shell>
  );
}
