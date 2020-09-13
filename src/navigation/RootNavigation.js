import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import NotFound from '../screens/NotFound';

export default ({ menu, homePath }) => (
  <Switch>
    <Route path='/' exact>
      <Redirect to={homePath} />
    </Route>
    {menu.map(item => (
      <Route key={item.path} path={item.path}>
        {item.screen}
      </Route>
    ))}
    <Route path='*'>
      <NotFound />
    </Route>
  </Switch>
);
