import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme Variables */
import './theme/variables.css';

/* Pages */
import Login        from './pages/Login';
import Register     from './pages/Register';
import Dashboard    from './pages/Dashboard';
import ProfileAdmin from './pages/ProfileAdmin';
import MapAdmin     from './pages/MapAdmin';
import Archived     from './pages/Archived';
import Users        from './pages/Users';
import UserDashboard from './pages/Userdashboard';
import Favorite     from './pages/Favorite';
import MapPage      from './pages/MapPage';
import ProfilePage  from './pages/ProfilePage';
import Edit         from './pages/Edit';   // ← single edit page, handles /edit/:id
import Search       from './pages/Search';
// EditSpot removed — merged into Edit.tsx

setupIonicReact();


if (Capacitor.isNativePlatform()) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const url    = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      const method = init?.method || (input instanceof Request ? input.method : 'GET');
      const headers = (init?.headers as Record<string, string>) || {};
      let data: any = undefined;

      if (init?.body) {
        try {
          data = JSON.parse(init.body as string);
        } catch {
          data = init.body;
        }
      }

      const response = await CapacitorHttp.request({ url, method, headers, data });

      const bodyStr = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

      return new Response(bodyStr, {
        status:  response.status,
        headers: new Headers(response.headers as Record<string, string>),
      });
    } catch (err) {
      // ✅ Fallback sa original fetch kung may error
      return originalFetch(input, init);
    }
  };
}


const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <IonRouterOutlet>

        {/* Default → Login */}
        <Route exact path="/">
          <Redirect to="/login" />
        </Route>

        {/* Auth */}
        <Route exact path="/login">
          <Login />
        </Route>
        <Route exact path="/register">
          <Register />
        </Route>

        {/* Admin */}
        <Route exact path="/dashboard">
          <Dashboard />
        </Route>
        <Route exact path="/profileadmin">
          <ProfileAdmin userId={0} />
        </Route>
        <Route exact path="/mapadmin">
          <MapAdmin />
        </Route>
        <Route exact path="/archived">
          <Archived />
        </Route>
        <Route exact path="/users">
          <Users />
        </Route>

        {/* Edit tourist spot — single unified route */}
        <Route exact path="/edit/:id">
          <Edit />
        </Route>

        {/* User */}
        <Route exact path="/userdashboard">
          <UserDashboard />
        </Route>
        <Route exact path="/favorite">
          <Favorite />
        </Route>
        <Route exact path="/mappage">
          <MapPage />
        </Route>
        <Route exact path="/profilepage">
          <ProfilePage />
        </Route>
        <Route exact path="/search">
          <Search />
        </Route>

        {/* Fallback → Login */}
        <Route>
          <Redirect to="/login" />
        </Route>

      </IonRouterOutlet>
    </IonReactRouter>
  </IonApp>
);

export default App;