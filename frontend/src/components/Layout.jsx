import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNavBar from './TopNavBar';

const Layout = () => {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="right-panel">
        <TopNavBar />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
