import React from "react";
import { Fragment, ReactNode } from "react";

interface OwnProps {
  when: any;
  children?: ReactNode;
}

const Render = ({ when, children }: OwnProps) => {
  return when ? <Fragment>{children}</Fragment> : null;
};

export default Render;
