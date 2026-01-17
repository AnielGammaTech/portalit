import CustomerDetail from './pages/CustomerDetail';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CustomerDetail": CustomerDetail,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "Integrations": Integrations,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};