import { LucideIcon } from 'lucide-react';
import Switch from './Switch';
import { Link } from 'react-router-dom';

interface TabLinkProps {
  active: boolean;
  to: string;
  icon: React.ElementType;
  label: string;
}

export interface TabConfig<T extends string> {
  value: T;
  to: string;
  icon: LucideIcon;
  label: string;
  Component?: React.ComponentType;
}

interface TabsProps<T extends string> {
  tabs: TabConfig<T>[];
  activeTab: T;
}

function TabLink({ active, to, icon: Icon, label }: TabLinkProps) {
  return (
    <Link
      to={to}
      className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-gold-600 text-gold-600'
          : 'border-transparent text-ink-400 hover:text-ink-200'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function Navigation<T extends string>({ tabs, activeTab }: TabsProps<T>) {
  return (
    <div className="flex items-center space-x-1 border-b border-ink-700 mb-8">
      {tabs.map(({ value, to, icon, label }) => (
        <TabLink
          key={value}
          active={activeTab === value}
          to={to}
          icon={icon}
          label={label}
        />
      ))}
    </div>
  );
}

function Content<T extends string>({ tabs, activeTab }: TabsProps<T>) {
  return (
    <Switch expression={activeTab}>
      {tabs
        .filter((tab): tab is TabConfig<T> & { Component: React.ComponentType } => !!tab.Component)
        .map(({ value, Component }) => (
          <Switch.CASE key={value} value={value}>
            <Component />
          </Switch.CASE>
        ))}
    </Switch>
  );
}

const Tabs = {
  Navigation,
  Content,
};

export default Tabs;
