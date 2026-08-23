package §_-42§
{
   import §_-Iw§.§_-SF§;
   import §_-Iw§.§_-Yj§;
   import §_-JM§.§_-3§;
   import §_-Js§.*;
   import com.qzone.qui.containers.ViewStack;
   import com.qzone.qui.controls.TabBar;
   import common.Session;
   import common.§_-4Y§;
   import common.§_-Ac§;
   import common.view.DataLoading;
   import common.view.window.§_-KR§;
   import common.view.window.§_-OJ§;
   import flash.display.DisplayObject;
   import flash.display.Sprite;
   import flash.events.Event;
   import framework.base.BaseTileItem;
   
   public class §_-1D§ extends §_-KR§
   {
      
      private var _selected:int;
      
      private var §_-YQ§:§_-9w§;
      
      private var §_-9-§:§_-Bi§;
      
      private var §_-6E§:§_-G8§;
      
      private var §_-FV§:ViewStack;
      
      private var §_-2w§:§_-Bi§;
      
      private var §_-SV§:TabBar;
      
      private var §_-Y§:§_-Fa§;
      
      private var §_-Xf§:§_-Ag§;
      
      private var §_-Z§:§_-Lb§;
      
      private var _loading:DataLoading;
      
      private var §_-VR§:§_-UW§;
      
      public function §_-1D§(param1:§_-Lb§)
      {
         super(param1.module.app as §_-3§);
         title = §_-4Y§.§_-Kf§["消息"];
         windowName = §_-Ac§.§_-aQ§;
         width = 500;
         height = 400;
         mode = true;
         this._selected = 0;
         this.§_-Z§ = param1;
      }
      
      public function set selected(param1:int) : void
      {
         if(param1 < 0)
         {
            param1 = 0;
         }
         this._selected = param1;
         title = param1 == 0 ? §_-4Y§.§_-Kf§["消息"] : §_-4Y§.§_-Kf§["个人信息"];
         if(this.§_-SV§ != null)
         {
            this.§_-SV§.selectedIndex = param1;
         }
         if(this.§_-Xf§ != null && this._selected == 1)
         {
            this.§_-Xf§.reset();
         }
      }
      
      private function onHistoryItemOut(param1:§_-SF§) : void
      {
         this.§_-R9§.hideTip();
      }
      
      private function onLogCleared(param1:§_-Yj§) : void
      {
         this.§_-R9§.model.reloadAll();
      }
      
      public function get §_-R9§() : §_-Lb§
      {
         return this.§_-Z§;
      }
      
      private function showLoading(param1:Boolean) : void
      {
         if(this._loading.visible == param1)
         {
            return;
         }
         this._loading.visible = param1;
         this.§_-VR§.visible = !param1;
         this.§_-SV§.visible = !param1;
         this.§_-FV§.visible = !param1;
      }
      
      override protected function init() : void
      {
         this.§_-VR§ = new §_-UW§();
         this.§_-VR§.x = 0;
         this.§_-VR§.y = 25;
         this.§_-VR§.visible = false;
         addChild(this.§_-VR§);
         this.§_-FV§ = new ViewStack();
         this.§_-FV§.width = width - 2;
         this.§_-SV§ = new TabBar();
         §_-OJ§.addTarget(this.§_-SV§);
         this.§_-SV§.x = 0;
         this.§_-SV§.y = 150;
         this.§_-SV§.width = width - 2;
         this.§_-SV§.viewStack = this.§_-FV§;
         this.§_-FV§.y = this.§_-SV§.y + this.§_-SV§.height;
         this.§_-FV§.height = height - this.§_-FV§.y;
         this.§_-Y§ = new §_-Fa§(this);
         this.§_-SV§.addTab(§_-4Y§.§_-Kf§["消息"],NaN,24);
         this.§_-FV§.addView(this.§_-Y§);
         this.§_-Xf§ = new §_-Ag§(this);
         this.§_-SV§.addTab(§_-4Y§.§_-Kf§["留言"],NaN,24);
         this.§_-FV§.addView(this.§_-Xf§);
         this.§_-9-§ = new §_-Bi§();
         this.§_-SV§.addTab(§_-4Y§.§_-Kf§["成果"],NaN,24);
         this.§_-FV§.addView(this.§_-9-§);
         this.§_-9-§.addEventListener(BaseTileItem.§_-Yu§,this.onHistoryItemOver,false,0,true);
         this.§_-9-§.addEventListener(BaseTileItem.§_-Jy§,this.onHistoryItemOut,false,0,true);
         this.§_-2w§ = new §_-Bi§();
         this.§_-SV§.addTab("成鱼",NaN,24);
         this.§_-FV§.addView(this.§_-2w§);
         this.§_-2w§.addEventListener(BaseTileItem.§_-Yu§,this.onHistoryItemOver,false,0,true);
         this.§_-2w§.addEventListener(BaseTileItem.§_-Jy§,this.onHistoryItemOut,false,0,true);
         this.§_-6E§ = new §_-G8§(this);
         this.§_-SV§.addTab("消费",NaN,24);
         this.§_-FV§.addView(this.§_-6E§);
         this.§_-YQ§ = new §_-9w§(this);
         this.§_-SV§.addTab("系统",NaN,24);
         this.§_-FV§.addView(this.§_-YQ§);
         this._loading = new DataLoading();
         this._loading.addEventListener(§_-SF§.§_-3e§,this.onLinkClicked);
         this._loading.visible = false;
         this._loading.x = width / 2;
         this._loading.y = height / 2 + 20;
         addChild(this._loading);
         this.§_-R9§.model.addEventListener(§_-5R§.§_-Ni§,this.onDataChanged,false,0,true);
         this.§_-R9§.model.addEventListener(§_-5R§.§_-x§,this.onDataError,false,0,true);
         this.§_-R9§.model.addEventListener(§_-5R§.§_-FU§,this.onDataLoading,false,0,true);
         this.§_-R9§.model.addEventListener(§_-5R§.§_-D9§,this.onLogCleared,false,0,true);
         this.§_-SV§.visible = false;
         this.§_-FV§.visible = false;
         addChild(this.§_-FV§);
         addChild(this.§_-SV§);
         this.§_-SV§.addEventListener(Event.CHANGE,this.onTabSwitched);
      }
      
      private function onDataChanged(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         this.showLoading(false);
         var _loc2_:String = param1.data["index"] as String;
         var _loc3_:Object = param1.data["data"];
         if(_loc2_ == "user")
         {
            this.§_-VR§.data = _loc3_["user"];
         }
         else if(_loc2_ == "log")
         {
            if(_loc3_["log"] is Array)
            {
               this.§_-Y§.dataList = _loc3_["log"];
            }
            else
            {
               this.§_-Y§.dataList = null;
            }
         }
         else if(_loc2_ == "chat")
         {
            if(_loc3_["chat"] is Array)
            {
               this.§_-Xf§.dataList = _loc3_["chat"];
            }
            else
            {
               this.§_-Xf§.dataList = null;
            }
         }
         else if(_loc2_ == "repertory")
         {
            if(_loc3_["repertory"] is Array)
            {
               this.§_-9-§.dataList = _loc3_["repertory"];
            }
            else
            {
               this.§_-9-§.dataList = null;
            }
         }
         else if(_loc2_ == "cost")
         {
            if(_loc3_["cost"] is Array)
            {
               this.§_-6E§.dataList = _loc3_["cost"];
            }
            else
            {
               this.§_-6E§.dataList = null;
            }
         }
         else if(_loc2_ == "systemMsg")
         {
            if(_loc3_["systemMsg"] is Array)
            {
               this.§_-YQ§.dataList = _loc3_["systemMsg"];
            }
            else
            {
               this.§_-YQ§.dataList = null;
            }
         }
         else if(_loc2_ == "fish")
         {
            if(_loc3_["fish"] is Array)
            {
               this.§_-2w§.dataList = _loc3_["fish"];
            }
            else
            {
               this.§_-2w§.dataList = null;
            }
         }
      }
      
      private function onDataLoading(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         this.showLoading(param1.data as Boolean);
      }
      
      public function get me() : Boolean
      {
         return this.§_-R9§.model.me;
      }
      
      override protected function onClose(param1:Event) : void
      {
         this.§_-VR§.showPhotoPic(false);
         this.§_-R9§.model.reset();
         if(this._selected == 0)
         {
            this.§_-Y§.dataList = null;
         }
         else if(this._selected == 1)
         {
            this.§_-Xf§.dataList = null;
         }
         else if(this._selected == 2)
         {
            this.§_-9-§.dataList = null;
         }
         else if(this._selected == 3)
         {
            this.§_-6E§.dataList = null;
         }
         else if(this._selected == 4)
         {
            this.§_-YQ§.dataList = null;
         }
         super.onClose(param1);
      }
      
      public function get selected() : int
      {
         return this._selected;
      }
      
      private function onDataError(param1:§_-Yj§) : void
      {
         this.showLoading(true);
         if(param1 != null && param1.data != null)
         {
            this._loading.errorText = param1.data["error"];
         }
      }
      
      public function §_-L3§(param1:int, param2:Boolean) : void
      {
         if(this.§_-SV§ != null && this.§_-FV§ != null)
         {
            if(param1 >= 0 && param1 < 5)
            {
               this.selected = param1;
            }
         }
         this.§_-VR§.showPhotoPic(true);
         var _loc3_:DisplayObject = this.§_-SV§.content.getChildAt(4);
         if(_loc3_ != null)
         {
            _loc3_.visible = param2 ? true : false;
         }
         this.§_-6E§.visible = param2 ? true : false;
         _loc3_ = this.§_-SV§.content.getChildAt(5);
         if(_loc3_ != null)
         {
            _loc3_.visible = param2 ? true : false;
         }
         this.§_-YQ§.visible = param2 ? true : false;
      }
      
      private function onTabSwitched(param1:Event) : void
      {
         this._selected = this.§_-SV§.selectedIndex;
         this.§_-R9§.model.§_-Z8§(this.§_-SV§.selectedIndex);
      }
      
      private function onHistoryItemOver(param1:§_-SF§) : void
      {
         this.§_-R9§.showTip(§_-Ac§.§_-JA§,param1.data);
      }
      
      override protected function setData() : void
      {
         this.graphics.clear();
         if(this.§_-Xf§ != null)
         {
            this.§_-Xf§.§_-3O§();
         }
         var _loc1_:Sprite = this.§_-SV§.content.getChildAt(3) as Sprite;
         if(_loc1_ != null)
         {
            _loc1_.visible = Session.getInstance().me;
         }
         _loc1_ = this.§_-SV§.content.getChildAt(4) as Sprite;
         if(_loc1_ != null)
         {
            _loc1_.visible = Session.getInstance().me;
         }
      }
      
      private function onLinkClicked(param1:§_-SF§) : void
      {
         if(param1.data == "reload")
         {
            this.§_-R9§.model.§_-Z8§(this.selected);
         }
      }
   }
}

