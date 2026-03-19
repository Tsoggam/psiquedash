// src/app/dashboard/layout.tsx
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Sidebar />
            <main className="app-content">{children}</main>
        </>
    )
}