package mc.view.main.leftInfo
{
   import common.CatchError;
   import flash.display.Sprite;
   import flash.events.Event;
   import mc.model.MData;
   import mc.model.MainData;
   import mc.model.ModelEvent;
   import mc.view.main.head.Level;

   public class LeftInfo extends Sprite
   {
      private var iconBar:MyIconBar;
      private var friendInfo:FriendInfo;

      public function LeftInfo()
      {
         super();
         CatchError.catchError(this.onUncaughtError,null,this.loaderInfo);
         this.iconBar = new MyIconBar();
         this.iconBar.y = 5;
         addChild(this.iconBar);
         this.friendInfo = new FriendInfo();
         MData.getInstance().mainData.addEventListener(MainData.CURRENT_USER_CHANGE,this.currentUserChange);
         MData.getInstance().mainData.addEventListener(MainData.UNREAD_DATA,this.setIconState);
         this.setIconState();
      }

      private function currentUserChange(param1:ModelEvent) : void
      {
         var _loc2_:Object = null;
         if(MData.getInstance().mainData.me)
         {
            addChild(this.iconBar);
            if(contains(this.friendInfo))
            {
               removeChild(this.friendInfo);
            }
         }
         else
         {
            if(contains(this.iconBar))
            {
               removeChild(this.iconBar);
            }
            addChild(this.friendInfo);
            _loc2_ = MData.getInstance().mainData.currentUser;
            this.friendInfo.url = _loc2_["headPic"];
            if(!_loc2_.hasOwnProperty("yellowstatus") || _loc2_["yellowstatus"] == 0 || _loc2_["yellowstatus"] == null)
            {
               this.friendInfo.color = Level.BLUE;
               this.friendInfo.vip = "";
            }
            else
            {
               this.friendInfo.color = Level.YELLOW;
               this.friendInfo.vip = "VipL" + _loc2_["yellowlevel"];
            }
            this.friendInfo.userName = _loc2_["userName"];
            this.friendInfo.exp = _loc2_["exp"];
            this.friendInfo.goldValue = _loc2_["money"];
            this.friendInfo.rpValue = _loc2_["moralexp"];
         }
      }

      private function setIconState(param1:Event = null) : void
      {
         if(this.iconBar == null)
         {
            return;
         }
         var _loc2_:Object = MData.getInstance().mainData.unreadData;
         if(_loc2_ != null)
         {
            this.iconBar.information = _loc2_["a"];
            this.iconBar.post = _loc2_["b"];
            this.iconBar.msg = _loc2_["c"];
            this.iconBar.gift = Boolean(_loc2_["d"]);
         }
      }

      private function onUncaughtError(param1:*) : void
      {
         param1.preventDefault();
      }
   }
}
