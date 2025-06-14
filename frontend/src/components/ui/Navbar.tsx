// components/ui/Navbar.tsx

'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { useState, useEffect } from 'react';
import { Container, Nav, Navbar } from 'react-bootstrap';

export default function AppNavbar() {
    const { user, loading } = useAuth();
    const [isClient, setIsClient] = useState(false);
    
    // 1. 新增一個 state 來專門控制 navbar 的展開/摺疊狀態
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
      setIsClient(true);
    }, []);

    // 在 loading 或 isClient 為 false 時，都顯示精簡版 Navbar
    if (loading || !isClient) {
        return (
            <Navbar expand="lg" bg="dark" data-bs-theme="dark">
                <Container fluid>
                    <Navbar.Brand as={Link} href="/">LaLaE</Navbar.Brand>
                </Container>
            </Navbar>
        );
    }

    return (
        // 2. 將 state 和控制函式綁定到 Navbar 上
        <Navbar 
            expand="lg" 
            bg="dark" 
            data-bs-theme="dark"
            expanded={expanded} // 將展開狀態交給 React state 控制
            onToggle={() => setExpanded(!expanded)} // 點擊漢堡按鈕時，切換 state
        >
            <Container fluid>
                <Navbar.Brand as={Link} href="/">LaLaE</Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    {/* 3. (優化) 為 Nav 加上 onClick，讓點擊連結後能自動關閉選單 */}
                    <Nav className="me-auto" onClick={() => setExpanded(false)}>

                        {user?.isAuthenticated && (
                            <>
                                <Nav.Link as={Link} href="/dashboard">Dashboard</Nav.Link>
                                <Nav.Link as={Link} href="/clients">Clients</Nav.Link>
                                <Nav.Link as={Link} href="/queries">Queries</Nav.Link>
                                <Nav.Link as={Link} href="/connections">Connections</Nav.Link>
                            </>
                        )}

                    </Nav>
                    <Nav onClick={() => setExpanded(false)}>
                        <Nav.Link as={Link} href="/about">About</Nav.Link>

                        {user?.isAuthenticated ? (
                            <>
                                <Nav.Link href="http://localhost:8000/users/logout/">Logout</Nav.Link>
                                <Navbar.Text>
                                    Signed in as: {user.username}
                                </Navbar.Text>
                            </>
                        ) : (
                            <>
                                <Nav.Link href="https://98dd-114-24-81-73.ngrok-free.app/users/login/">Login</Nav.Link>
                                <Nav.Link href="https://98dd-114-24-81-73.ngrok-free.app/users/register/">Register</Nav.Link>
                            </>
                        )}
                        
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}