'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { useState } from 'react';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Button from 'react-bootstrap/Button';

export default function AppNavbar() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <Navbar expand="lg" bg="dark" data-bs-theme="dark">
                <Container fluid>
                    <Navbar.Brand>LaLaE</Navbar.Brand>
                </Container>
            </Navbar>
        );
      }

  return (
    // ★★★ 修正點：將 className="bg-dark" 改為 bg="dark" 這個 prop ★★★
    <Navbar expand="lg" bg="dark" data-bs-theme="dark">
      <Container fluid>
        <Navbar.Brand as={Link} href="/">LaLaE</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {user?.isAuthenticated && (
              <>
                <Nav.Link as={Link} href="/dashboard">Dashboard</Nav.Link>
                <Nav.Link as={Link} href="/clients">Clients</Nav.Link>
                <Nav.Link as={Link} href="/queries">Queries</Nav.Link>
                <Nav.Link as={Link} href="/connections">Connections</Nav.Link>
              </>
            )}
          </Nav>
          <Nav>
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
                <Nav.Link href="http://localhost:8000/users/login/">Login</Nav.Link>
                <Nav.Link href="http://localhost:8000/users/register/">Register</Nav.Link>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
